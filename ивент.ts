import {
	MessageEmbed,
	Message,
	TextChannel,
	VoiceChannel,
	CollectorFilter,
	User,
	PartialUser,
	MessageReaction,
} from "discord.js";
import moment from "moment";
import { IActiveEventSchema, activeEvents } from "../../db/models/activeEvents";
import { eventsModel } from "../../db/models/eventsModel";
import { mastersBlacklistModel } from "../../db/models/mastersBlacklist";
import {
	ICOMMAND,
	config,
	FUNCS,
	startingEvent,
	customCooldown,
} from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивент",
	category: "Events",
	desc: "Команда для запуска ивента",
	cooldown: 5,
	usage: config.PREFIX + "ивент",
	permission: "User",
	run: async (client, args, msg) => {
		if (
			(await mastersBlacklistModel.findOne({ uid: msg.author.id })) ||
			msg.member?.roles.cache.has(config.IDS.ROLEIDS.EventBanRoleID)
		) {
			return msg.reply(
				`Вы не можете запустить ивент, т.к. находиться в чёрном списке "временных ведущих". Обратитесь к администрации`
			);
		}

		const activeEvent = await activeEvents.findOne({
			master: msg.author.id,
		});

		if (activeEvent) {
			return msg.reply(
				`у тебя уже зарегистрирован ивент **${
					activeEvent.event.name
				}**. ${
					activeEvent.announceMsgId
						? `Зайдите в <#${activeEvent.rooms?.voice?.main}> что бы начать его`
						: ""
				}`
			);
		}

		if (
			customCooldown.has(msg.author.id) &&
			customCooldown.get(msg.author.id)!.time > new Date().getTime()
		) {
			return msg.reply(
				`Вы сможете запустить ивент через ${getMinutes(
					customCooldown.get(msg.author.id)!.time
				)}`
			);
		}

		const messages: string[] = [];
		const eventData = {} as IActiveEventSchema;
		const events = await eventsModel.find();

		const user = msg.author;
		const eventSelection = new MessageEmbed()
			.setColor("PURPLE")
			.setDescription(
				`Выберите ивент написав в чат его цифру\n` +
					events
						.map(
							(event, index) => `\`#${index + 1}\` ${event.name}`
						)
						.join("\n") +
					`\nВы можете отменить процедуру запуска ивента написав "отмена"`
			);

		if (!events.length) {
			return;
		}

		await msg.channel
			.send(user.toString(), eventSelection)
			.then((m) => messages.push(m.id));

		const filter = (message: Message) => {
			return message.author.id === user.id;
		};

		const eventNumber = await collectAnswer(msg, filter, messages);

		if (!eventNumber || eventNumber === "отмена") {
			msg.channel
				.send(`${user.toString()} Запуск ивента был отменен`)
				.then((m) => m.delete({ timeout: 10000 }));
			return abortEventStart(msg, user, messages);
		}

		const choosenEvent = events[Number(eventNumber) - 1];
		if (!choosenEvent) {
			msg.channel
				.send(`${user.toString()} Ивента с таким номером нет в списке`)
				.then((m) => m.delete({ timeout: 10000 }));
			return abortEventStart(msg, user, messages);
		}

		await msg.channel
			.send(
				`${user.toString()} Сколько слотов? Укажите цифру от **3** до **30**`
			)
			.then((m) => messages.push(m.id));

		const slots = await collectAnswer(msg, filter, messages);
		if (!slots || slots === "отмена") {
			msg.channel
				.send(`${user.toString()} Запуск ивента был отменен`)
				.then((m) => m.delete({ timeout: 10000 }));
			return abortEventStart(msg, user, messages);
		}
		if (isNaN(Number(slots)) || Number(slots) < 3 || Number(slots) > 30) {
			msg.channel
				.send(`${user.toString()} Вы указали неверное кол-во слотов`)
				.then((m) => m.delete({ timeout: 10000 }));
			return abortEventStart(msg, user, messages);
		}

		if (choosenEvent.withSite) {
			await msg.channel
				.send(
					`${user.toString()} Укажите ссылку на сайт на котором будет проводиться ивент`
				)
				.then((m) => messages.push(m.id));

			const site = await collectAnswer(msg, filter, messages);

			if (!site || site === "отмена") {
				msg.channel
					.send(`${user.toString()} Запуск ивента был отменен`)
					.then((m) => m.delete({ timeout: 10000 }));
				return abortEventStart(msg, user, messages);
			}

			eventData.site = site;
		}

		eventData.event = choosenEvent;
		eventData.slots = Number(slots);
		eventData.startType = 1;
		eventData.master = user.id;

		const parent = msg.guild?.channels.cache.get(
			config.IDS.CHANNELIDS.eventsCategoryID
		);

		let textChannel: TextChannel | undefined;
		let voiceChannel: VoiceChannel | undefined;

		const closeData = eventData.event?.closeData;

		let channels;

		switch (eventData.startType) {
			case 1:
				textChannel = await msg.guild?.channels.create(
					eventData.event?.name!,
					{
						parent: parent!.id,
						type: "text",
					}
				);

				textChannel?.updateOverwrite(user.id, {
					VIEW_CHANNEL: true,
				});

				voiceChannel = await msg.guild?.channels.create(
					eventData.event?.name!,
					{
						parent: parent!.id,
						type: "voice",
						userLimit: eventData.slots,
					}
				);

				voiceChannel?.updateOverwrite(msg.guild!.id, {
					VIEW_CHANNEL: true,
				});

				voiceChannel?.updateOverwrite(user.id, {
					PRIORITY_SPEAKER: true,
				});

				if (closeData?.isClose) {
					channels = await FUNCS.createCloseEventRooms(
						msg.guild!,
						eventData
					);
				}

				const embedInfo = new MessageEmbed()
					.setColor("YELLOW")
					.setImage(eventData.event.eventImage)
					.setDescription(
						`Добро пожаловать на ивент **${eventData.event.name}**!` +
							`\n\nУ вас есть возможность дать ведущему доп. баллы.` +
							`\nДля это-го вам нужно написать \`!гол\` и выбрать оценку от **1** до **5**.` +
							`\nПримечание: *вы можете это сделать, **1** раз за ивент, и только после нахождения **5** минут на нём.*`
					);

				const newEmbed = new MessageEmbed()
					.setColor("YELLOW")
					.setTitle("Команды")
					.setDescription(`\n\`!ивзавершить @победитель\` (можно несколько победителей через пробел) - чтобы завершить ивент и записать победителей
					\n\`!ивстоп\` - чтобы завершить ивент если он не собрался
					\n\`!кик @user\` - кикнуть с ивента участника который мешает проводить ивент`);

				await textChannel!.send(embedInfo).then((m) => m.pin());
				await textChannel!
					.send(msg.author.toString(), newEmbed)
					.then((m) => m.pin());

				if (eventData.site) {
					await textChannel
						?.send(
							`Ивент будет проводиться на этом сайте: <${eventData.site}>`
						)
						.then((m) => m.pin());
				}

				const rightnowEmbed = {
					title: `${eventData.event.name} от ${user.username}`,
					color: 15723756,
					description:
						`Дорогие пользователи нашего сервера\nпрямо **СЕЙЧАС** будет проведен ивент **${eventData.event.name}**` +
						`\n<:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166>`,
					author: {
						name: "Сейчас",
					},
					image: {
						url: `${eventData.event.eventImage}`,
					},
					fields: [
						{
							name: "🔊 Подключится",
							value: `<#${voiceChannel?.id}>`,
							inline: true,
						},
					],
				};

				eventData.rooms = {
					text: {
						main: textChannel!.id,
					},
					voice: {
						main: voiceChannel!.id,
						addional: channels,
					},
				};
				eventData.eventStarted = new Date().getTime();
				eventData.membersData = [];
				eventData.startedByTimedMaster = {
					announceEmbed: rightnowEmbed,
				};

				await activeEvents.create(eventData);
				break;
		}
		bulkDelete(msg, messages);
		msg.channel
			.send(
				`${user.toString()} вы успешно запустили ивент **${
					eventData.event.name
				}** ✅`
			)
			.then((m) => m.delete({ timeout: 10000 }));
		const logChannel = msg.guild?.channels.cache.get(
			config.IDS.CHANNELIDS.eventsLogsChannelID
		) as TextChannel;
		const embed = new MessageEmbed().setDescription(
			`Временный ведущий ${msg.author.toString()} запускает **${
				eventData.event.name
			}**`
		);

		const defaultChat = msg.guild!.channels.cache.get(
			config.IDS.CHANNELIDS.GeneralChat
		) as TextChannel;

		defaultChat.send(
			`Временный ведущий **${msg.author.username}** запускает ивент <#${
				eventData.rooms!.voice!.main
			}>`
		);

		logChannel.send(embed);
	},
};

async function collectAnswer(
	msg: Message,
	filter: CollectorFilter,
	messages: string[]
): Promise<string | undefined> {
	const collected = await msg.channel.awaitMessages(filter, {
		max: 1,
		time: 1000 * 60 * 3,
	});
	const recievedMsg = collected.first();

	if (!recievedMsg) {
		msg.channel
			.send(`Вы не дали ответ вовремя.`)
			.then((m) => m.delete({ timeout: 10000 }));
		return "отмена";
	}

	messages.push(recievedMsg.id);
	if (recievedMsg.content === "отмена") return "отмена";
	return recievedMsg.content!;
}

function bulkDelete(msg: Message, messages: string[]) {
	if (msg.channel.type === "text") {
		msg.channel.bulkDelete(messages);
	}
}

function abortEventStart(
	msg: Message,
	user: User | PartialUser,
	messages: string[]
) {
	bulkDelete(msg, messages);
	return startingEvent.delete(user.id);
}

function getMinutes(time: number) {
	const duration = moment.duration(time);
	const minutes = duration.minutes();
	return minutes;
}

export default cmd;
