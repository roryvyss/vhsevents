import { MessageEmbed, TextChannel, VoiceState } from "discord.js";
import { activeEvents, IMembersData } from "../db/models/activeEvents";
import { IEvent, config, FUNCS } from "../settings/utils";

const event: IEvent<"voiceStateUpdate"> = {
	name: "voiceStateUpdate",
	run: async (oldState, newState, client) => {
		if ((oldState.guild.id || newState.guild.id) != config.IDS.GUILDID)
			return;

		const logChannel = client.channels.cache.get(
			config.IDS.CHANNELIDS.logChannelID
		) as TextChannel;

		if (oldState.channel && !newState.channel) {
			voiceLeave(oldState, logChannel);
			userLeaveEvent(oldState, newState);
		}

		if (
			oldState.channel &&
			newState.channel &&
			oldState.channelID != newState.channelID
		) {
			voiceSwitch(oldState, newState, logChannel);
			userLeaveEvent(oldState, newState);
			userJoinEvent(newState);
		}

		if (!oldState.channel && newState.channel) {
			voiceJoin(newState, logChannel);
			userJoinEvent(newState);
		}
	},
};

function voiceLeave(state: VoiceState, logChannel: TextChannel) {
	const embed = new MessageEmbed()
		.setColor("PURPLE")
		.setTitle("Отключение от голосового канала")
		.setDescription(
			`Пользователь ${state.member?.toString()} отключился от канала\n${state.channel?.toString()}`
		)
		.setFooter(`ID: ${state.member?.id}`)
		.setTimestamp(new Date());

	logChannel.send(embed);
}
function voiceJoin(state: VoiceState, logChannel: TextChannel) {
	const embed = new MessageEmbed()
		.setColor("PURPLE")
		.setTitle("Подключение к голосовому каналу")
		.setDescription(
			`Пользователь ${state.member?.toString()} подключился к каналу\n${state.channel?.toString()}`
		)
		.setFooter(`ID: ${state.member?.id}`)
		.setTimestamp(new Date());

	logChannel.send(embed);
}

function voiceSwitch(
	oldState: VoiceState,
	newState: VoiceState,
	logChannel: TextChannel
) {
	const embed = new MessageEmbed()
		.setColor("PURPLE")
		.setTitle("Переход в другой голосовой канал")
		.setDescription(
			`Пользователь ${newState.member?.toString()} перешел с ${oldState.channel?.toString()} в ${newState.channel?.toString()}`
		)
		.setFooter(`ID: ${newState.member?.id}`)
		.setTimestamp(new Date());

	logChannel.send(embed);
}

async function userLeaveEvent(oldState: VoiceState, newState: VoiceState) {
	const member = oldState.member!;
	const channel = oldState.channel!;

	const activeEvent = await activeEvents.findOne({
		$or: [
			{ "rooms.voice.main": channel?.id },
			{
				"rooms.voice.addional": channel?.id,
			},
		],
	});

	if (!activeEvent) return;

	if (activeEvent.master != member!.id) {
		let eventChannels = [activeEvent.rooms?.voice?.main];
		activeEvent.rooms?.voice?.addional
			? (eventChannels = eventChannels.concat(
					activeEvent.rooms?.voice?.addional
			  ))
			: null;
		if (newState.channel && eventChannels.includes(newState.channel.id))
			return;
		const idx = getIdx(activeEvent!.membersData!, member!.id);
		if (idx === Number("-1")) return;

		const membersData = activeEvent.membersData[idx];
		const addMins = FUNCS.getMins(
			new Date().getTime() - membersData.joinDate!
		);

		console.log(
			`${member.user.username} вышел с ивента, и просидел в нём: ${addMins} минут`
		);
		activeEvent.membersData![idx].totalMins =
			membersData.totalMins + addMins;
		activeEvent.membersData![idx].joinDate = null;

		const textChannel = channel.guild.channels.cache.get(
			activeEvent.rooms!.text!.main
		) as TextChannel;

		if (textChannel) {
			textChannel.updateOverwrite(member, {
				VIEW_CHANNEL: null,
			});
		}

		await activeEvents.updateOne(
			{
				_id: activeEvent._id,
			},
			activeEvent
		);
		return;
	}

	try {
		await member?.setNickname("");
	} catch (err) {}
}

async function userJoinEvent(state: VoiceState) {
	const member = state.member!;
	const channel = state.channel!;

	const activeEvent = await activeEvents.findOne({
		$or: [
			{ "rooms.voice.main": channel?.id },
			{
				"rooms.voice.addional": channel?.id,
			},
		],
	});

	if (!activeEvent) return;
	if (activeEvent.master != member?.id) {
		if (activeEvent.delayedLaunch && activeEvent.delayedLaunch.stage != 1)
			return;
		const idx = getIdx(activeEvent!.membersData!, member!.id);
		if (idx < 0) {
			console.log(`${member.user.username} подключился к ивенту`);
			activeEvent!.membersData!.push({
				uid: member!.id,
				messages: 0,
				totalMins: 0,
				joinDate: new Date().getTime(),
			});
		} else {
			const membersData = activeEvent.membersData[idx];
			if (
				activeEvent.event.closeData.isClose &&
				membersData.joinDate != null
			)
				return;
			console.log(`${member.user.username} подключился к ивенту`);
			activeEvent.membersData![idx].joinDate = new Date().getTime();
		}

		const textChannel = channel.guild.channels.cache.get(
			activeEvent.rooms!.text!.main
		) as TextChannel;

		if (textChannel) {
			textChannel.updateOverwrite(member, {
				VIEW_CHANNEL: true,
			});
		}

		await activeEvents.updateOne(
			{
				_id: activeEvent._id,
			},
			activeEvent
		);
		return;
	}

	if (activeEvent.rooms!.voice!.main === channel!.id) {
		try {
			await member?.setNickname("! Ведущий");
		} catch (err) {}
	}

	if (activeEvent.delayedLaunch && activeEvent.delayedLaunch.stage === 2) {
		try {
			await channel?.setName(activeEvent.event!.name!);
			const textChannel = await channel!.guild.channels.create(
				activeEvent.event!.name!,
				{
					type: "text",
					parent: channel!.parent!.id,
				}
			);

			await channel?.updateOverwrite(channel.guild.id, {
				CONNECT: true,
				VIEW_CHANNEL: true,
			});

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

			const announceChannel = state.guild.channels.cache.get(
				config.IDS.CHANNELIDS.eventAnnounceChannelID
			) as TextChannel;
			try {
				const announceMsg = await announceChannel.messages.fetch(
					activeEvent.announceMsgId
				);
				const eventStart = {
					title: `${activeEvent.event.name} от ${member?.user.username}`,
					color: 15723756,
					description:
						`Начался ивент **${activeEvent.event.name}**` +
						`\n<:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166>` +
						`\n<:arrowL:757210873860194364>Победители получают:` +
						`\n**${
							activeEvent.event.starsAmount
						} звёзд** ${await FUNCS.getCurrencyLogo(state.guild)}${
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
							value: `${channel?.toString()}`,
							inline: true,
						},
						{
							name: "🔕 Отключить пинги?",
							value: `[Нажми на реакцию 🔰](${config.removeEventRoleMsgLink})`,
							inline: true,
						},
					],
				};
				announceMsg.edit({
					embed: eventStart,
				});
			} catch (err) {}

			let channels;
			if (activeEvent.event!.closeData!.isClose) {
				channels = await FUNCS.createCloseEventRooms(
					state.guild,
					activeEvent
				);
			}

			activeEvent.rooms = {
				voice: {
					main: activeEvent.rooms!.voice!.main,
					addional: channels,
				},
				text: {
					main: textChannel.id,
				},
			};
			activeEvent.eventStarted = new Date().getTime();
			activeEvent.delayedLaunch.stage = 1;
			await activeEvents.updateOne(
				{
					_id: activeEvent._id,
				},
				activeEvent
			);
			await channel?.setUserLimit(activeEvent!.slots!);
		} catch (err) {
			console.log(err);
		}
	} else if (
		activeEvent.delayedLaunch &&
		activeEvent.delayedLaunch.stage === 3
	) {
		try {
			await activeEvents.updateOne(
				{
					_id: activeEvent._id,
				},
				{
					$set: {
						"delayedLaunch.stage": 1,
						eventStarted: new Date().getTime(),
					},
				}
			);
		} catch (err) {
			console.log(err);
		}
	}
}

function getIdx(array: IMembersData[], userID: string) {
	return array.findIndex((item) => item.uid === userID);
}

export default event;
