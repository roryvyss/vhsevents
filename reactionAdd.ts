import {
	CollectorFilter,
	Message,
	MessageEmbed,
	MessageReaction,
	PartialUser,
	User,
	TextChannel,
	VoiceChannel,
} from "discord.js";
import { IEvent, startingEvent, config, FUNCS } from "../settings/utils";
import { activeEvents, IActiveEventSchema } from "../db/models/activeEvents";
import { eventsModel } from "../db/models/eventsModel";
import moment from "moment";

const event: IEvent<"messageReactionAdd"> = {
	name: "messageReactionAdd",
	run: async (reaction, user, client) => {
		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch (err) {
				return;
			}
		}

		if (user.partial) {
			try {
				await user.fetch();
			} catch (err) {
				return;
			}
		}

		if (user.bot) return;
		if (reaction.message.guild?.id != config.IDS.GUILDID) return;

		switch (reaction.message.id) {
			case config.IDS.MESSAGEIDS.controlPannelMessage:
				if (startingEvent.has(user.id)) return;
				reaction.users.remove(user.id);
				await handleEventStart(reaction, user);
				if (startingEvent.has(user.id)) startingEvent.delete(user.id);
				break;
		}

		switch (reaction.message.channel.id) {
			case config.IDS.CHANNELIDS.eventAnnounceChannelID:
				switch (reaction.emoji.name) {
					case "🟢":
						joinEventQueue(reaction, user);
						break;
				}
		}
	},
};

const types = {
	1: "`#1`: Ивент запустится сейчас.",
	2: "`#2`: Ивент запустится через указаное вами время, максимум до **60** минут.",
	3: "`#3`: Ивент запустится только после того, как наберется нужное кол-во игроков. Сбор работает **30** минут.",
};

async function handleEventStart(
	reaction: MessageReaction,
	user: User | PartialUser
) {
	const activeEvent = await activeEvents.findOne({
		master: user.id,
	});

	if (activeEvent) return;

	startingEvent.set(user.id, user.id);
	await collectData(user, reaction);
	startingEvent.delete(user.id);
}

async function collectData(
	user: User | PartialUser,
	reaction: MessageReaction
) {
	const generalChat = reaction.message!.guild!.channels.cache.get(
		config.IDS.CHANNELIDS.GeneralChat
	) as TextChannel;
	const msg = reaction.message;
	const messages: string[] = [];
	const eventData = {} as IActiveEventSchema;
	const events = await eventsModel.find();
	const eventSelection = new MessageEmbed()
		.setColor("PURPLE")
		.setDescription(
			`Выберите ивент написав в чат его цифру\n` +
				events
					.map((event, index) => `\`#${index + 1}\` ${event.name}`)
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
		return abortEventStart(msg, user, messages, reaction);
	}

	const choosenEvent = events[Number(eventNumber) - 1];
	if (!choosenEvent) {
		msg.channel
			.send(`${user.toString()} Ивента с таким номером нет в списке`)
			.then((m) => m.delete({ timeout: 10000 }));
		return abortEventStart(msg, user, messages, reaction);
	}

	const alreadyStarted = await activeEvents.findOne({
		"event.name": choosenEvent.name,
	});

	if (alreadyStarted) {
		msg.channel
			.send(
				`${user.toString()} Вы не можете запустить этот ивент, т.к. его проводит другой Ведущий.`
			)
			.then((m) => m.delete({ timeout: 5000 }));
		return abortEventStart(msg, user, messages, reaction);
	} else if (
		choosenEvent.cooldown &&
		choosenEvent.cooldown.expireTime > new Date().getTime()
	) {
		const duration = moment.duration(
			choosenEvent.cooldown.expireTime - new Date().getTime()
		);
		const minutes = duration.minutes();
		msg.channel
			.send(
				`${user.toString()} У этого ивента еще не прошло КД. Вам нужно подождать: **${minutes}** мин`
			)
			.then((m) => m.delete({ timeout: 5000 }));
		return abortEventStart(msg, user, messages, reaction);
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
		return abortEventStart(msg, user, messages, reaction);
	}
	if (isNaN(Number(slots)) || Number(slots) < 3 || Number(slots) > 30) {
		msg.channel
			.send(`${user.toString()} Вы указали неверное кол-во слотов`)
			.then((m) => m.delete({ timeout: 10000 }));
		return abortEventStart(msg, user, messages, reaction);
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
			return abortEventStart(msg, user, messages, reaction);
		}

		eventData.site = site;
	}

	await msg.channel
		.send(
			`${user.toString()} Укажите тип запуска, доступные:\n${choosenEvent.startType
				.map((type) => types[type])
				.join("\n")}`
		)
		.then((m) => messages.push(m.id));

	const startingType = await collectAnswer(msg, filter, messages);

	if (!startingType || startingType === "отмена") {
		msg.channel
			.send(`${user.toString()} Запуск ивента был отменен`)
			.then((m) => m.delete({ timeout: 10000 }));
		return abortEventStart(msg, user, messages, reaction);
	}
	if (!choosenEvent.startType?.includes(Number(startingType))) {
		msg.channel
			.send(
				`${user.toString()} Вы указали тип запуска, который не соответствует допустимым типам запускам этого ивента`
			)
			.then((m) => m.delete({ timeout: 10000 }));
		return abortEventStart(msg, user, messages, reaction);
	}

	switch (Number(startingType)) {
		case 2:
			await msg.channel
				.send(
					`${user.toString()} Укажите время в минутах через сколько ивент должен начаться.\n(Указывайте минуты которые будут кратные \`5\`. Т.е. \`5\`, \`10\`, \`15\`, \`20\` и т.д. максимум до \`60\`)`
				)
				.then((m) => messages.push(m.id));

			const minutes = await collectAnswer(msg, filter, messages);

			if (!minutes || minutes === "отмена") {
				msg.channel
					.send(`${user.toString()} Запуск ивента был отменен`)
					.then((m) => m.delete({ timeout: 10000 }));
				return abortEventStart(msg, user, messages, reaction);
			}

			if (Number(minutes) > 60 || Number(minutes) < 1) {
				msg.channel
					.send(
						`${user.toString()} Вы не можете отложить запуск на больше чем **60** минут, или меньше **1** минуты`
					)
					.then((m) => m.delete({ timeout: 5000 }));
				return abortEventStart(msg, user, messages, reaction);
			}

			const secondTypeDate =
				new Date().getTime() + Number(minutes) * 60 * 1000;

			eventData.delayedLaunch = {
				minutes,
				stage: Number(startingType),
				startIn: secondTypeDate,
			};
			break;
		case 3:
			const thirdTypeDate = new Date().getTime() + 30 * 60 * 1000;
			eventData.delayedLaunch = {
				minutes: "30",
				stage: Number(startingType),
				startIn: thirdTypeDate,
			};
			break;
	}

	eventData.event = choosenEvent;
	eventData.slots = Number(slots);
	eventData.startType = Number(startingType);
	eventData.master = user.id;

	const parent = msg.guild?.channels.cache.get(
		config.IDS.CHANNELIDS.eventsCategoryID
	);

	let textChannel: TextChannel | undefined;
	let voiceChannel: VoiceChannel | undefined;

	const announceChannel = msg.guild?.channels.cache.get(
		config.IDS.CHANNELIDS.eventAnnounceChannelID
	) as TextChannel;

	const closeData = eventData.event?.closeData;

	let channels;
	let announceMsg: Message;

	switch (eventData.startType) {
		case 1:
			textChannel = await msg.guild?.channels.create(
				eventData.event?.name!,
				{
					parent: parent!.id,
					type: "text",
				}
			);

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

			await textChannel!.send(embedInfo).then((m) => m.pin());

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
					`Дорогие пользователи нашего сервера, прямо **СЕЙЧАС** будет проведен ивент **${eventData.event.name}**` +
					`\n<:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166>` +
					`\n<:L_:757210873860194364>Победители получают:` +
					`\n**${
						eventData.event.starsAmount
					} звёзд** ${await FUNCS.getCurrencyLogo(
						reaction.message.guild!
					)}${
						eventData.event.timedRoleID
							? ` и роль <@&${eventData.event.timedRoleID}> на **7 дней**`
							: ""
					}` +
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
					{
						name: "🔕 Отключить пинги?",
						value: `[Нажми на реакцию 🔰](${config.removeEventRoleMsgLink})`,
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

			announceMsg = await announceChannel.send(
				`<@&${config.IDS.ROLEIDS.EventRoleID}>`,
				{
					embed: rightnowEmbed,
				}
			);

			eventData.announceMsgId = announceMsg.id;
			generalChat.send(
				`Ведущий **${user.username}** запускает ивент <#${
					voiceChannel!.id
				}>`
			);
			await activeEvents.create(eventData);
			break;
		case 2:
			const date = new Date(eventData.delayedLaunch?.startIn!);
			const asd = date.toLocaleString("ru", {
				timeZone: "Europe/Moscow",
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			});
			voiceChannel = await msg.guild?.channels.create(
				`[${asd} МСК] ${eventData.event?.name}`,
				{
					parent: parent?.id,
					type: "voice",
				}
			);

			voiceChannel?.updateOverwrite(msg.guild!.id, {
				CONNECT: false,
				VIEW_CHANNEL: true,
			});

			const secondStart = {
				title: `${eventData.event.name} от ${user.username}`,
				color: 15723756,
				description:
					`Дорогие пользователи нашего сервера.\nЧерез **${eventData.delayedLaunch?.minutes}** минут [${asd} МСК] будет проведен ивент **${eventData.event.name}**` +
					`\n<:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166>` +
					`\n<:L_:757210873860194364>Победители получают:` +
					`\n**${
						eventData.event.starsAmount
					} звёзд** ${await FUNCS.getCurrencyLogo(
						reaction.message.guild!
					)}${
						eventData.event.timedRoleID
							? ` и роль <@&${eventData.event.timedRoleID}> на **7 дней**`
							: ""
					}` +
					`\n<:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166>`,
				author: {
					name: `Через ${eventData.delayedLaunch?.minutes} минут [${asd} МСК]`,
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
					{
						name: "🔕 Отключить пинги?",
						value: `[Нажми на реакцию 🔰](${config.removeEventRoleMsgLink})`,
						inline: true,
					},
				],
			};

			eventData.rooms! = {
				voice: {
					main: voiceChannel!.id,
				},
			};
			eventData.membersData = [];
			announceMsg = await announceChannel.send(
				`<@&${config.IDS.ROLEIDS.EventRoleID}>`,
				{
					embed: secondStart,
				}
			);
			eventData.announceMsgId = announceMsg.id;
			generalChat.send(
				`В **${asd}** по МСК будет ивент **${choosenEvent.name}** от ведущего **${user.username}**`
			);
			await activeEvents.create(eventData);
			break;
		case 3:
			const thirdStartDate = new Date(eventData.delayedLaunch!.startIn!);
			const thing = thirdStartDate.toLocaleString("ru", {
				timeZone: "Europe/Moscow",
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			});

			const thirdStart = {
				title: `${eventData.event.name} от ${user.username}`,
				color: 15723756,
				description:
					`Дорогие пользователи нашего сервера. Открылся набор на ивент **${eventData.event.name}**` +
					`\n\nНажмите на 🟢 чтобы записаться на ивент` +
					`\n\`\`\`fix\nНужно игроков для старта: ${eventData.slots}\`\`\`` +
					`\n<:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166>` +
					`\n<:arrowL:757210873860194364>Победители получают:` +
					`\n**${
						eventData.event.starsAmount
					} звёзд** ${await FUNCS.getCurrencyLogo(
						reaction.message.guild!
					)}${
						eventData.event.timedRoleID
							? ` и роль <@&${eventData.event.timedRoleID}> на **7 дней**`
							: ""
					}` +
					`\n<:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166>` +
					`\n:warning: Если вы запишитесь на ивент и не придете, то вы получите роль <@&${config.IDS.ROLEIDS.EventWarnRoleID}> на 3 дня.\n`,
				author: {
					name: `Набор игроков 0/${eventData.slots}`,
				},
				image: {
					url: `${eventData.event.eventImage}`,
				},
				thumbnail: {},
				footer: {
					text: `Сбор будет активен до [${thing} МСК]`,
				},
				fields: [
					{
						name: "🔊 Подключится",
						value: `**0/${eventData.slots}** - [набор игроков]`,
						inline: true,
					},
					{
						name: "🔕 Отключить пинги?",
						value: `[Нажми на реакцию 🔰](${config.removeEventRoleMsgLink})`,
						inline: true,
					},
				],
			};

			announceMsg = await announceChannel.send(
				`<@&${config.IDS.ROLEIDS.EventRoleID}>`,
				{
					embed: thirdStart,
				}
			);

			announceMsg.react("🟢");

			eventData.membersData = [];
			eventData.delayedLaunch!.lobby = {
				players: [],
				messageId: announceMsg.id,
			};

			generalChat.send(
				`Ведущий **${user.username}** начал сбор на ивент **${choosenEvent.name}**, записаться:\n<${announceMsg.url}>`
			);
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
}

async function collectAnswer(
	msg: Message,
	filter: CollectorFilter,
	messages: string[]
): Promise<string | undefined> {
	const collected = await msg.channel.awaitMessages(filter, {
		max: 1,
		time: 600000,
	});
	const recievedMsg = collected.first();

	if (!recievedMsg) {
		msg.channel
			.send(`Вы не дали ответ вовремя, нажмите еще раз на реакцию`)
			.then((m) => m.delete({ timeout: 10000 }));
		return;
	}

	messages.push(recievedMsg.id);
	if (recievedMsg.content === "отмена") return "отмена";
	return recievedMsg.content!;
}

async function joinEventQueue(
	reaction: MessageReaction,
	user: User | PartialUser
) {
	const message = reaction.message;
	const member = await message.guild?.members.fetch(user.id);

	if (member?.roles.cache.has(config.IDS.ROLEIDS.EventBanRoleID)) return;

	const activeEvent = await activeEvents.findOne({
		"delayedLaunch.lobby.messageId": message.id,
	});

	if (!activeEvent) return;

	activeEvent.delayedLaunch!.lobby!.players?.push(member!.id);

	const totalPlayers = activeEvent.delayedLaunch!.lobby!.players!.length;

	let embed = message.embeds[0];
	let players = "";
	let pos = 1;

	if (totalPlayers) {
		for (const player of activeEvent.delayedLaunch?.lobby?.players!) {
			try {
				const member = await message.guild?.members.fetch(player);
				players += `\`#${pos}\` - ${member?.toString()} (${
					member?.user.username
				})\n`;
			} catch (err) {
				players += `👻\n`;
			}
			pos += 1;
		}
	}

	const thirdStartDate = new Date(activeEvent.delayedLaunch!.startIn!);
	const locale = thirdStartDate.toLocaleString("ru", {
		timeZone: "Europe/Moscow",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const master = await message.guild?.members.fetch(activeEvent.master);

	const thirdStart = {
		title: `${activeEvent.event.name} от ${master!.user.username}`,
		color: 15723756,
		description:
			`Дорогие пользователи нашего сервера. Открылся набор на ивент **${activeEvent.event.name}**` +
			`\n\nНажмите на 🟢 чтобы записаться на ивент` +
			`\n\`\`\`fix\nНужно игроков для старта: ${activeEvent.slots}\`\`\`` +
			`\n${players}` +
			`\n<:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166>` +
			`\n<:arrowL:757210873860194364>Победители получают:` +
			`\n**${
				activeEvent.event.starsAmount
			} звёзд** ${await FUNCS.getCurrencyLogo(message.guild!)}${
				activeEvent.event.timedRoleID
					? ` и роль <@&${activeEvent.event.timedRoleID}> на **7 дней**`
					: ""
			}` +
			`\n<:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166>` +
			`\n:warning: Если вы запишитесь на ивент и не придете, то вы получите роль <@&${config.IDS.ROLEIDS.EventBanRoleID}> на 3 дня.\n`,
		author: {
			name: `Набор игроков ${totalPlayers}/${activeEvent.slots}`,
		},
		image: {
			url: `${activeEvent.event.eventImage}`,
		},
		footer: {
			text: `Сбор будет активен до [${locale} МСК]`,
		},
		fields: [
			{
				name: "🔊 Подключится",
				value: `**${totalPlayers}/${activeEvent.slots}** - [набор игроков]`,
				inline: true,
			},
			{
				name: "🔕 Отключить пинги?",
				value: `[Нажми на реакцию 🔰](${config.removeEventRoleMsgLink})`,
				inline: true,
			},
		],
	};

	embed = new MessageEmbed(thirdStart);

	await activeEvents.updateOne(
		{
			_id: activeEvent._id,
		},
		activeEvent
	);

	message.edit(`<@&${config.IDS.ROLEIDS.EventRoleID}>`, embed);

	if (totalPlayers === activeEvent.slots) {
		await endPlayerSearching(reaction, user, activeEvent);
	}
}

async function endPlayerSearching(
	reaction: MessageReaction,
	user: User | PartialUser,
	activeEvent: IActiveEventSchema
) {
	const message = reaction.message;
	const master = await message.guild?.members.fetch(activeEvent.master!);
	const parent = message.guild?.channels.cache.get(
		config.IDS.CHANNELIDS.eventsCategoryID
	);

	const textChannel = await message.guild?.channels.create(
		activeEvent.event!.name!,
		{
			type: "text",
			parent: parent!.id,
		}
	);

	const voiceChannel = await message.guild?.channels.create(
		activeEvent.event!.name!,
		{
			type: "voice",
			userLimit: activeEvent.slots,
			parent: parent!.id,
		}
	);

	voiceChannel?.updateOverwrite(message.guild!.id, {
		VIEW_CHANNEL: true,
	});

	const embed = new MessageEmbed()
		.setColor("PURPLE")
		.setDescription(
			`Игроки на ваш ивент **${
				activeEvent.event?.name
			}** набрались\nВ течении **10** минут вам нужно зайти на ивент. Клик ${voiceChannel?.toString()}`
		);

	let channels;

	if (activeEvent.event.closeData.isClose) {
		channels = await FUNCS.createCloseEventRooms(
			message.guild!,
			activeEvent
		);
	}

	activeEvent.rooms! = {
		voice: {
			main: voiceChannel!.id,
			addional: channels,
		},
		text: {
			main: textChannel!.id,
		},
	};

	FUNCS.updChannelPerms(activeEvent, message.guild!);

	activeEvent.delayedLaunch!.startIn = new Date().getTime() + 10 * 60 * 1000;

	await activeEvents.updateOne(
		{
			_id: activeEvent._id,
		},
		activeEvent
	);

	const embedInfo = new MessageEmbed()
		.setColor("YELLOW")
		.setImage(activeEvent.event.eventImage)
		.setDescription(
			`Добро пожаловать на ивент **${activeEvent.event.name}**!` +
				`\n\nУ вас есть возможность дать ведущему доп. баллы.` +
				`\nДля это-го вам нужно написать \`!гол\` и выбрать оценку от **1** до **5**.` +
				`\nПримечание: *вы можете это сделать, **1** раз за ивент, и только после нахождения **5** минут на нём.*`
		);

	await textChannel!.send(embedInfo).then((m) => m.pin());

	if (activeEvent.site) {
		await textChannel
			?.send(
				`Ивент будет проводиться на этом сайте: <${activeEvent.site}>`
			)
			.then((m) => m.pin());
	}

	const playersList = new MessageEmbed()
		.setAuthor(`Люди которые записались на ивент`)
		.setColor("PURPLE");

	const totalPlayers = activeEvent.delayedLaunch!.lobby!.players!.length;

	let players = "";
	let pos = 1;

	if (totalPlayers) {
		for (const player of activeEvent.delayedLaunch?.lobby?.players!) {
			try {
				const member = await message.guild?.members.fetch(player);
				players += `\`#${pos}\` - ${member?.toString()} (${
					member?.user.username
				})\n`;
			} catch (err) {
				players += `👻\n`;
			}
			pos += 1;
		}
	}

	playersList.setDescription(players);

	const thirdStart = {
		title: `${activeEvent.event.name} от ${master?.user.username}`,
		color: 15723756,
		description:
			`Начался ивент **${activeEvent.event.name}**` +
			`\n\n\`Участники:\`\n${players}` +
			`\n<:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166>` +
			`\n<:arrowL:757210873860194364>Победители получают:` +
			`\n**${
				activeEvent.event.starsAmount
			} звёзд** ${await FUNCS.getCurrencyLogo(message.guild!)}${
				activeEvent.event.timedRoleID
					? ` и роль <@&${activeEvent.event.timedRoleID}> на **7 дней**`
					: ""
			}` +
			`\n<:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166>`,
		author: {
			name: `Сейчас`,
		},
		image: {
			url: `${activeEvent.event.eventImage}`,
		},

		fields: [
			{
				name: "🔊 Подключится",
				value: `${voiceChannel?.toString()}`,
				inline: true,
			},
			{
				name: "🔕 Отключить пинги?",
				value: `[Нажми на реакцию 🔰](${config.removeEventRoleMsgLink})`,
				inline: true,
			},
		],
	};

	textChannel?.send(master?.toString(), playersList);
	message.reactions.removeAll();
	message.edit({
		embed: thirdStart,
	});
	master!.user.send(embed);
}

function bulkDelete(msg: Message, messages: string[]) {
	if (msg.channel.type === "text") {
		msg.channel.bulkDelete(messages);
	}
}

function abortEventStart(
	msg: Message,
	user: User | PartialUser,
	messages: string[],
	reaction: MessageReaction
) {
	bulkDelete(msg, messages);
	return startingEvent.delete(user.id);
}

export default event;
