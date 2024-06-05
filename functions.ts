import {
	Guild,
	GuildChannel,
	GuildMember,
	Message,
	MessageEmbed,
	TextChannel,
	VoiceChannel,
} from "discord.js";
import moment from "moment";
import { activeEvents, IActiveEventSchema } from "../db/models/activeEvents";
import { configModel } from "../db/models/configsModel";
import { eventsModel } from "../db/models/eventsModel";
import { IEventMasterProfile, masterModel } from "../db/models/masterProfile";
import { starsFromEventModel } from "../db/models/starsFromEventModel";
import { unixesModel } from "../db/models/unixesModel";
import { userModel } from "../db/models/usersModel";
import { config } from "./utils";

const requiredPermission: {
	[key: string]: (msg: Message) => {
		allowed: boolean | undefined;
		position: number;
	};
} = {
	Dev: (msg: Message) => {
		return {
			allowed: msg.author.id === config.IDS.USERIDS.DEV,
			position: 8,
		};
	},
	Admin: (msg: Message) => {
		return {
			allowed: msg.member?.roles.cache.has(
				config.IDS.ROLEIDS.AdminRoleID
			),
			position: 7,
		};
	},
	JunAdm: (msg: Message) => {
		return {
			allowed: msg.member?.roles.cache.has(
				config.IDS.ROLEIDS.JunAdminRoleID
			),
			position: 6,
		};
	},
	Moderator: (msg: Message) => {
		return {
			allowed: msg.member?.roles.cache.has(
				config.IDS.ROLEIDS.ModeratorRoleID
			),
			position: 5,
		};
	},
	Support: (msg: Message) => {
		return {
			allowed: msg.member?.roles.cache.has(
				config.IDS.ROLEIDS.SupportRoleID
			),
			position: 4,
		};
	},
	EventCurator: (msg: Message) => {
		return {
			allowed: msg.member?.roles.cache.has(
				config.IDS.ROLEIDS.EventCuratorRoleID
			),
			position: 3,
		};
	},
	EventMaster: (msg: Message) => {
		return {
			allowed: msg.member?.roles.cache.has(
				config.IDS.ROLEIDS.EventMasterRoleID
			),
			position: 2,
		};
	},
	User: (msg: Message) => {
		return {
			allowed: msg.member?.roles.cache.has(
				config.IDS.ROLEIDS.UserDefault
			),
			position: 1,
		};
	},
};

const FUNCS = {
	checkPerms: (permission: string, msg: Message) => {
		const filteredPermissions = Object.keys(requiredPermission).filter(
			(perm) => perm != permission
		);
		const { allowed, position } = requiredPermission[permission](msg);

		let cmdAllowed = allowed;
		let highPosition = position;

		if (!cmdAllowed) {
			for (const perm of filteredPermissions) {
				const { allowed, position } = requiredPermission[perm](msg);
				if (allowed && position > highPosition) {
					cmdAllowed = true;
				}
			}
		}

		if (!cmdAllowed) {
			msg.reply(`у вас нет прав использовать эту команду.`);
		}

		return cmdAllowed;
	},
	pad: (number: number) => {
		return ("0" + number).slice(-2);
	},
	getMins: (time: number) => {
		const duration = moment.duration(time);
		return Math.floor(duration.asMinutes());
	},
	getLogChannel: (guild: Guild) => {
		return guild.channels.cache.get(
			config.IDS.CHANNELIDS.logChannelID
		) as TextChannel;
	},
	getEventChannelsAndDelete: (
		activeEvent: IActiveEventSchema,
		guild: Guild
	) => {
		const rooms = activeEvent.rooms!;
		let channels: string[] = [];
		if (rooms.voice) {
			rooms.voice.main ? channels.push(rooms.voice.main) : null;
			rooms.voice.addional
				? (channels = channels.concat(rooms.voice.addional))
				: null;
		}
		if (rooms.text) {
			rooms.text.main ? channels.push(rooms.text.main) : null;
			rooms.text.addional ? channels.concat(rooms.text.addional) : null;
		}

		for (const channel of channels) {
			guild.channels.cache.get(channel!)?.delete();
		}
	},
	calcWeekRating: (masterProfile: IEventMasterProfile) => {
		const eventsDone = masterProfile.weekStats.weekEvents.length
			? masterProfile.weekStats.weekEvents
					.map((event) => event.timesDone)
					.reduce((first, second) => {
						return first + second;
					})
			: 0;
		const variety = masterProfile.weekStats.weekEvents.length
			? masterProfile.weekStats.weekEvents
					.map((event) => event.eventVariety)
					.reduce((first, second) => {
						return first! + second!;
					})
			: 0;
		const totalMins = masterProfile.weekStats.minutesOnEvent;
		const points = masterProfile.weekStats.points;

		const weekRating =
			(eventsDone * 3.3 + totalMins / 100 + points / 30) * variety!;
		return Math.floor(weekRating);
	},
	calcMonthRating: (masterProfile: IEventMasterProfile) => {
		const monthRating = masterProfile.weekRatings.length
			? masterProfile.weekRatings
					.map((rating) => rating.rating)
					.reduce((first, second) => {
						return first + second;
					})
			: 0;

		return Math.floor(monthRating);
	},
	logMessage: (guild: Guild, message: string) => {
		const channel = guild.channels.cache.get(
			config.IDS.CHANNELIDS.eventsLogsChannelID
		)! as TextChannel;
		const logEmbed = new MessageEmbed()
			.setAuthor(
				`Новый лог`,
				channel.client.user?.displayAvatarURL({
					size: 2048,
					dynamic: true,
				})
			)
			.setDescription(message)
			.setTimestamp()
			.setColor("#2F3136");
		channel.send(logEmbed);
	},
	getCurrencyLogo: async (guild: Guild) => {
		const guildConfig = await configModel.findOne({
			guildId: guild.id,
		});
		return guildConfig?.CurrencyLogo;
	},
	rewardWinners: async (
		activeEvent: IActiveEventSchema,
		winners: GuildMember[],
		msg: Message
	) => {
		const event = activeEvent.event;

		const existInEvents = await starsFromEventModel.findOne({
			eventName: event.name,
		});

		if (existInEvents) {
			await starsFromEventModel.updateOne(
				{
					eventName: event.name,
				},
				{
					$inc: {
						totalStars: winners.length * event.starsAmount,
					},
				}
			);
		} else {
			await starsFromEventModel.create({
				eventName: event.name,
				totalStars: winners.length * event.starsAmount,
			});
		}

		for (const member of winners) {
			const existInStars = await starsFromEventModel.findOne({
				uid: member.id,
			});

			await userModel.updateOne(
				{ userId: member.id },
				{ $inc: { Currency: event.starsAmount } },
				{ upsert: true, setDefaultsOnInsert: true }
			);

			let roleReward = "";

			if (event.timedRoleID) {
				const unixesTime =
					Math.floor(new Date().getTime() / 1000) + 86400 * 7;
				let time = 0;

				const timeRole = await unixesModel.findOne({
					role: event.timedRoleID,
					userId: member.id,
					Type: 2,
				});

				if (timeRole) {
					time = timeRole.time + (8 / 64e4) * 7;
					await unixesModel.updateOne(
						{
							role: timeRole.role,
							userId: timeRole.userId,
							Type: timeRole.Type,
						},
						{
							$set: { time },
						}
					);
				} else {
					time = unixesTime;

					await unixesModel.insertMany({
						userId: member.id,
						time,
						role: event.timedRoleID,
						Type: 2,
					});

					member.roles.add(event.timedRoleID);
				}

				roleReward = `И роль <@&${event.timedRoleID}> до <t:${time}>`;
			}

			const rewardEmbed = new MessageEmbed()
				.setDescription(
					`${member.toString()} за победу в ивенте от <@${
						activeEvent.master
					}>` +
						`\nполучил **${event.starsAmount}** <a:Star:640970350775238656>\n${roleReward}`
				)
				.setColor(member.displayColor!);

			const spravChannel = msg.guild?.channels.cache.get(
				config.IDS.CHANNELIDS.spravChannelID
			) as TextChannel;

			spravChannel.send(rewardEmbed);

			if (existInStars) {
				const eventIdx = existInStars.eventsData.findIndex(
					(entry) => entry.eventName === event.name
				);
				if (eventIdx === Number("-1")) {
					existInStars.eventsData.push({
						eventName: event.name,
						totalStars: event.starsAmount,
					});
				} else {
					existInStars.eventsData[eventIdx].totalStars +=
						event.starsAmount;
				}
				await starsFromEventModel.updateOne(
					{
						uid: member.id,
					},
					existInStars
				);
			} else {
				await starsFromEventModel.create({
					uid: member.id,
					eventsData: [
						{
							eventName: event.name,
							totalStars: event.starsAmount,
						},
					],
				});
			}
		}
	},
	sleep: (ms: number) => {
		return new Promise((resolve) => setTimeout(resolve, ms));
	},
	endEvent: async (
		msg: Message,
		activeEvent: IActiveEventSchema,
		journalChannel: TextChannel,
		winners: GuildMember[],
		isTotalEnd?: boolean,
		changeEmbed: boolean = true
	) => {
		let totalMessages = 0;
		let totalMinutes = 0;

		if (activeEvent.membersData.length) {
			for (const member of activeEvent.membersData) {
				totalMinutes += member.totalMins;
				totalMessages += member.messages;
			}
		}

		const eventDuration = FUNCS.getMins(
			new Date().getTime() - activeEvent.eventStarted
		);

		const sortedMembersByTime = activeEvent.membersData.sort((a, b) => {
			return b.totalMins - a.totalMins;
		});

		const filteredMembersByTime = activeEvent.membersData.filter(
			(item) => item.totalMins > eventDuration / 2
		);

		const activeVoiceMember = sortedMembersByTime[0]?.totalMins
			? `<@${sortedMembersByTime[0].uid}> (**${sortedMembersByTime[0].totalMins}** мин)`
			: "Нет";

		const sortedMembersByMessages = activeEvent.membersData.sort((a, b) => {
			return b.messages - a.messages;
		});

		const activeChatMember = sortedMembersByMessages[0]?.messages
			? `<@${sortedMembersByMessages[0].uid}> (**${sortedMembersByMessages[0].messages}** смс)`
			: "Нет";

		const listedMembersByTime = filteredMembersByTime.length
			? filteredMembersByTime
					.map((item, index) => `\`${index + 1}.\` <@${item.uid}>`)
					.join("\n")
			: "Список пуст.";
		const listedWinners = winners.length
			? winners
					.map(
						(item, index) => `\`${index + 1}.\` ${item.toString()}`
					)
					.join(", ")
			: "Команда **ИВСТОП**";

		const eventStarted = new Date(activeEvent.eventStarted);
		const localeString = eventStarted.toLocaleString("ru", {
			timeZone: "Europe/Moscow",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});

		const master = await msg.guild?.members.fetch(activeEvent.master);

		const endEmbed = {
			title: activeEvent.event.name,
			color: 7340032,
			description: `**Участники (более 50% времени):**\n${listedMembersByTime}\n<:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166><:L_:797862551550427166>\n**Победители:**\n${listedWinners}`,
			author: {
				name: `Ведущий: ${master!.user.username}`,
			},
			image: {
				url: `${activeEvent.event.eventImage}`,
			},
			footer: {
				text: `Ивент начался в ${localeString} ┃ тип запуска: ${activeEvent.startType}`,
				icon_url: "https://i.imgur.com/X7r11mG.png",
			},
			fields: [
				{
					name: "👨 На ивенте:",
					value: `\`\`\`fix\n${activeEvent.membersData.length} человек\n\`\`\``,
					inline: true,
				},
				{
					name: "⏱ Длился:",
					value: `\`\`\`fix\n${eventDuration} минут\n\`\`\``,
					inline: true,
				},
				{
					name: "✉️ Сообщений:",
					value: `\`\`\`fix\n${totalMessages} смс\n\`\`\``,
					inline: true,
				},
				{
					name: "🔊 Войс-онлайн",
					value: `\`\`\`fix\n${totalMinutes} минут\n\`\`\``,
					inline: true,
				},
			],
		};

		if (isTotalEnd) {
			let totalPoints = 0;
			if (activeEvent.points?.length) {
				for (const entry of activeEvent.points) {
					totalPoints += entry.point;
				}
			}
			endEmbed.fields.push({
				name: "🔹 Баллы",
				value: `\`\`\`fix\n${totalPoints}\`\`\``,
				inline: true,
			});
		}

		endEmbed.fields.push({
			name: "📈 Топ-1",
			value: `📨 текст: ${activeChatMember}\n🎙  войс: ${activeVoiceMember}`,
			inline: true,
		});

		await journalChannel.send(master!.toString(), {
			embed: endEmbed,
		});

		if (isTotalEnd) {
			if (changeEmbed) {
				const announceChannel = msg.guild?.channels.cache.get(
					config.IDS.CHANNELIDS.eventAnnounceChannelID
				) as TextChannel;
				const msgToFetch =
					activeEvent.startType != 3
						? activeEvent.announceMsgId
						: activeEvent.delayedLaunch!.lobby!.messageId!;

				const announceMsg = await announceChannel.messages.fetch(
					msgToFetch
				);

				const idx = announceMsg.embeds[0].fields.findIndex(
					(field) => field.name === "🔊 Подключится"
				);
				announceMsg.embeds[0].fields[idx].value = "`Ивент закончился`";

				announceMsg.edit(announceMsg.embeds[0]);
			}

			if (!activeEvent.startedByTimedMaster) {
				await eventsModel.updateOne(
					{
						name: activeEvent.event.name,
					},
					{
						cooldown: {
							expireTime: new Date().getTime() + 1000 * 60 * 30,
							lastInvoker: msg.author.id,
						},
					}
				);
			}

			await activeEvents.deleteOne({
				_id: activeEvent._id,
			});

			FUNCS.updEmbedStats(msg.guild!);
		} else {
			activeEvent.repeats += 1;
			activeEvent.eventStarted = new Date().getTime();

			activeEvent.membersData = activeEvent.membersData.map((member) => {
				return {
					joinDate: new Date().getTime(),
					messages: 0,
					totalMins: 0,
					uid: member.uid,
				};
			});

			await activeEvents.updateOne(
				{
					_id: activeEvent._id,
				},
				activeEvent
			);
		}
	},
	updateMasterProfile: async (
		activeEvent: IActiveEventSchema,
		message: Message,
		isTotalEnd?: boolean
	) => {
		const masterProfile = await masterModel.findOne({
			uid: message.author.id,
		});

		if (!masterProfile) return;

		let totalMins = 0;
		let totalMessages = 0;

		if (activeEvent.membersData.length) {
			for (const member of activeEvent.membersData) {
				totalMins += member.totalMins;
				totalMessages += member.messages;
			}
		}

		masterProfile.weekStats.minutesOnEvent += totalMins;
		masterProfile.weekStats.messagesOnEvent
			? (masterProfile.weekStats.messagesOnEvent += totalMessages)
			: (masterProfile.weekStats.messagesOnEvent = totalMessages);

		const eventIdx = masterProfile?.completedEvents.findIndex(
			(event) => event.name === activeEvent.event.name
		);
		const weekEventIdx = masterProfile.weekStats.weekEvents.findIndex(
			(event) => event.name === activeEvent.event.name
		);

		const timesDone = activeEvent.repeats >= 1 ? 0 : 1;

		if (eventIdx === Number("-1")) {
			masterProfile?.completedEvents.push({
				name: activeEvent.event.name,
				timesDone,
			});
		} else {
			masterProfile.completedEvents[eventIdx].timesDone += timesDone;
		}

		if (weekEventIdx === Number("-1")) {
			masterProfile.weekStats.weekEvents.push({
				name: activeEvent.event.name,
				timesDone,
				eventVariety: activeEvent.event.variety,
			});
		} else {
			masterProfile.weekStats.weekEvents[weekEventIdx].timesDone +=
				timesDone;
		}

		if (!activeEvent.repeats) {
			masterProfile.xp += 10;
		}

		const needXp =
			10 * (masterProfile.lvl + 1) * (masterProfile.lvl + 1) +
			10 * (masterProfile.lvl + 1) +
			10;

		let completedEvents = 0;
		for (const completed of masterProfile.completedEvents) {
			completedEvents += completed.timesDone;
		}

		if (masterProfile.xp >= needXp) {
			masterProfile.lvl += 1;
			const annch = message.guild?.channels.cache.get(
				"605182338682454035"
			) as TextChannel;
			annch.send(
				`${message.member?.toString()} ты провел **${completedEvents}** ивентов и получил уровень **${
					masterProfile.lvl
				}**`
			);
		}

		const winners = message.mentions.members?.size!;
		const stars = winners * activeEvent.event.starsAmount;

		masterProfile.weekStats.starsEarned += stars;
		masterProfile.starsEarned += stars;

		if (isTotalEnd) {
			let totalPoints = 0;
			if (activeEvent.points?.length) {
				for (const entry of activeEvent.points) {
					totalPoints += entry.point;
				}
			}

			masterProfile.weekStats.points += totalPoints;
			masterProfile.weekStats.peopleOnEvent += activeEvent.membersData
				.length
				? activeEvent.membersData.length
				: 0;
		}

		await masterModel.updateOne(
			{
				_id: masterProfile._id,
			},
			masterProfile
		);
	},
	lockEventChannels: async (
		activeEvent: IActiveEventSchema,
		guild: Guild
	) => {
		let channels: string[] | GuildChannel[] = [
			activeEvent.rooms!.voice!.main,
		];

		if (activeEvent.rooms?.voice?.addional) {
			channels = activeEvent.rooms.voice.addional;
		}

		channels = channels.map((channel) => {
			return guild.channels.cache.get(channel!)!;
		});

		for (const channel of channels) {
			await channel.updateOverwrite(guild.id, {
				CONNECT: false,
			});
		}
	},
	updChannelPerms: async (activeEvent: IActiveEventSchema, guild: Guild) => {
		let channels: string[] | GuildChannel[] = [
			activeEvent.rooms!.voice!.main,
		];

		if (activeEvent.rooms?.voice?.addional) {
			channels = activeEvent.rooms.voice.addional;
		}

		channels = channels.map((channel) => {
			return guild.channels.cache.get(channel!)!;
		});

		switch (activeEvent.startType) {
			case 3:
				const players = activeEvent.delayedLaunch?.lobby?.players!;
				for (const player of players) {
					channels.map((channel) => {
						if (
							channel.id === activeEvent.rooms?.voice?.main &&
							activeEvent.event.closeData.isClose
						)
							return;
						channel.updateOverwrite(player, {
							CONNECT: true,
							VIEW_CHANNEL: true,
						});
						channel.updateOverwrite(guild.id, {
							VIEW_CHANNEL: true,
							CONNECT: false,
						});
					});
				}
				break;
		}
	},
	updEmbedStats: async (guild: Guild) => {
		console.time("updEmbedStats");
		const _ = guild?.channels.cache.get(
			config.IDS.CHANNELIDS.adminStatsChannelID
		) as TextChannel;

		const masters = await masterModel.find();

		const mastersRatings: {
			uid: string;
			weekRating: number;
			monthRating: number;
		}[] = [];

		const completedEventsByMonth: {
			name: string;
			timesDone: number;
		}[] = [];
		const completedEventsByWeek: {
			name: string;
			timesDone: number;
		}[] = [];

		let eventsByWeek = 0;
		let eventsByMonth = 0;

		for (const master of masters) {
			const masterMessage = master.profileMessage
				? await _.messages.fetch(master.profileMessage)
				: null;

			const completedEventsByMonthP: {
				name: string;
				timesDone: number;
			}[] = [];

			const masterRatingWeek = FUNCS.calcWeekRating(master);
			const masterRatingMonth = master.weekRatings.length
				? FUNCS.calcMonthRating(master) + masterRatingWeek
				: masterRatingWeek;

			if (!master.removeProfileTime) {
				mastersRatings.push({
					uid: master.uid,
					weekRating: masterRatingWeek,
					monthRating: masterRatingMonth,
				});
			}

			if (master.weekStats.weekEvents.length) {
				for (const event of master.weekStats.weekEvents) {
					eventsByWeek += event.timesDone;

					const idx = completedEventsByWeek.findIndex(
						(item) => item.name === event.name
					);
					const secondIdx = completedEventsByMonth.findIndex(
						(item) => item.name === event.name
					);

					if (idx === Number("-1")) {
						completedEventsByWeek.push({
							name: event.name,
							timesDone: event.timesDone,
						});
					} else {
						if (completedEventsByWeek[idx]) {
							completedEventsByWeek[idx].timesDone +=
								event.timesDone;
						}
					}

					if (secondIdx === Number("-1")) {
						completedEventsByMonth.push({
							name: event.name,
							timesDone: event.timesDone,
						});
					} else {
						if (completedEventsByMonth[secondIdx]) {
							completedEventsByMonth[secondIdx].timesDone +=
								event.timesDone;
						}
					}
				}
			}
			if (master.weekRatings.length) {
				for (const weekRating of master.weekRatings) {
					if (weekRating.weekEvents.length) {
						for (const event of weekRating.weekEvents) {
							if (event.timesDone) {
								eventsByMonth += event.timesDone;
							}

							const idx = completedEventsByMonth.findIndex(
								(item) => item.name === event.name
							);

							if (idx === Number("-1")) {
								completedEventsByMonth.push({
									name: event.name,
									timesDone: event.timesDone,
								});
							} else {
								if (completedEventsByMonth[idx]) {
									completedEventsByMonth[idx].timesDone +=
										event.timesDone;
								}
							}

							const secondIdx = completedEventsByMonthP.findIndex(
								(item) => item.name === event.name
							);

							if (secondIdx === Number("-1")) {
								completedEventsByMonthP.push({
									name: event.name,
									timesDone: event.timesDone,
								});
							} else {
								if (completedEventsByMonthP[secondIdx]) {
									completedEventsByMonthP[
										secondIdx
									].timesDone += event.timesDone;
								}
							}
						}
					}
				}
			}

			const listedEventsByWeek = master.weekStats.weekEvents.length
				? master.weekStats.weekEvents
						.sort((a, b) => {
							return b.timesDone - a.timesDone;
						})
						.map(
							(item, idx) =>
								`\`#${idx + 1}\` ${item.name} - **${
									item.timesDone
								}**`
						)
						.join("\n")
				: "Список пуст";
			const listedEventsByMonth = completedEventsByMonthP.length
				? completedEventsByMonthP
						.sort((a, b) => {
							return b.timesDone - a.timesDone;
						})
						.map(
							(item, idx) =>
								`\`#${idx + 1}\` ${item.name} - **${
									item.timesDone
								}**`
						)
						.join("\n")
				: "Список пуст";

			const mastersEventRateByWeek = master.weekStats.weekEvents.length
				? master.weekStats.weekEvents
						.map((item) => item.timesDone)
						.reduce((first, second) => {
							return first + second;
						})
				: 0;
			const mastersEventRateByMonth = completedEventsByMonthP.length
				? completedEventsByMonthP
						.map((item) => item.timesDone)
						.reduce((first, second) => {
							return first + second;
						})
				: 0;

			const varietyRate = master.weekStats.weekEvents.length
				? master.weekStats.weekEvents
						.map((event) => event.eventVariety)
						.reduce((first, second) => {
							return first! + second!;
						})
				: 0;

			const monthPay = master.weekRatings.length
				? master.weekRatings.reduce((a, b) => {
						return a + b.celery;
				  }, 0)
				: 0;

			const weekPay =
				varietyRate! > 4
					? mastersEventRateByWeek * 50 + (varietyRate! - 4) * 50
					: mastersEventRateByWeek * 50;

			const embed = new MessageEmbed()
				.setColor("RANDOM")
				.setFooter(master.uid)
				.setDescription(
					`${
						master.removeProfileTime
							? "**Временный ведущий!**\n"
							: ""
					}Стата ведущего: <@${master.uid}>` +
						`\nКол-во ивентов за неделю: **${mastersEventRateByWeek}**, месяц: **${
							mastersEventRateByMonth + mastersEventRateByWeek
						}**` +
						`\nНедельный рейтинг: **${masterRatingWeek}**, месячный: **${masterRatingMonth}**\n${
							master.removeProfileTime
								? ""
								: `Зп за неделю: **${weekPay}**, месяц: **${
										monthPay + weekPay
								  }**`
						}` +
						`\nСписок ивентов\n**(недельный)**:\n${listedEventsByWeek}\n**(месячный)**:\n${listedEventsByMonth}`
				);

			if (!masterMessage) {
				const sentMsg = await _.send(embed);
				await masterModel.updateOne(
					{
						uid: master.uid,
					},
					{
						$set: {
							profileMessage: sentMsg.id,
						},
					}
				);
			} else {
				masterMessage.edit(embed);
			}
		}

		const weekStatsMessage = await _.messages.fetch(
			config.IDS.MESSAGEIDS.weekMessageStats
		);
		const monthStatsMessage = await _.messages.fetch(
			config.IDS.MESSAGEIDS.monthMessageStats
		);

		const mastersRatingsListedByWeek = mastersRatings
			.sort((a, b) => {
				return b.weekRating - a.weekRating;
			})
			.map(
				(item, idx) =>
					`\`#${idx + 1}\` <@${item.uid}> - **${item.weekRating}**`
			)
			.join("\n");
		const completedEventsByWeekListed = completedEventsByWeek.length
			? completedEventsByWeek
					.sort((a, b) => {
						return b.timesDone - a.timesDone;
					})
					.map(
						(item, idx) =>
							`\`#${idx + 1}\` ${item.name} - **${
								item.timesDone
							}**`
					)
					.join("\n")
			: "Список пуст.";

		const weekEmbed = new MessageEmbed()
			.setColor("YELLOW")
			.setTitle("Недельная стата")
			.setDescription(
				`Ивентов за неделю: **${eventsByWeek}**` +
					`\nРейтинги ведущих:\n${mastersRatingsListedByWeek}` +
					`\nПроведённые ивенты:\n${completedEventsByWeekListed}`
			);

		// МЕСЯЧНАЯ СТАТА НИЖЕ

		const mastersRatingsListedByMonth = mastersRatings
			.sort((a, b) => {
				return b.monthRating - a.monthRating;
			})
			.map(
				(item, idx) =>
					`\`#${idx + 1}\` <@${item.uid}> - **${item.monthRating}**`
			)
			.join("\n");
		const completedEventsByMonthListed = completedEventsByMonth.length
			? completedEventsByMonth
					.sort((a, b) => {
						return b.timesDone - a.timesDone;
					})
					.map(
						(item, idx) =>
							`\`#${idx + 1}\` ${item.name} - **${
								item.timesDone
							}**`
					)
					.join("\n")
			: "Список пуст.";

		const monthEmbed = new MessageEmbed()
			.setColor("YELLOW")
			.setTitle("Месячная стата")
			.setDescription(
				`Ивентов за месяц: **${eventsByMonth + eventsByWeek}**` +
					`\nРейтинги ведущих:\n${mastersRatingsListedByMonth}` +
					`\nПроведённые ивенты:\n${completedEventsByMonthListed}`
			);

		if (weekStatsMessage) weekStatsMessage?.edit(weekEmbed);
		if (monthStatsMessage) monthStatsMessage?.edit(monthEmbed);
		console.timeEnd("updEmbedStats");
	},
	createCloseEventRooms: async (
		guild: Guild,
		activeEvent: IActiveEventSchema
	): Promise<string[]> => {
		const closeData = activeEvent.event?.closeData;

		let voiceChannels: string[] = [];

		const names = [closeData!.firstVoiceName, closeData!.secondVoiceName];

		const parent = guild?.channels.cache.get(
			config.IDS.CHANNELIDS.eventsCategoryID
		);

		for (const name of names) {
			const channel = await guild?.channels.create(name!, {
				type: "voice",
				userLimit: 5,
				parent: parent!.id,
			});

			channel.updateOverwrite(guild.id, {
				VIEW_CHANNEL: true,
			});

			voiceChannels.push(channel!.id);
		}

		return voiceChannels;
	},
	moveMembers: async (activeEvent: IActiveEventSchema, guild: Guild) => {
		const checkDate = new Date().getTime();

		let members: GuildMember[] = [];
		let channels = [activeEvent.rooms?.voice?.main];
		if (activeEvent.rooms?.voice?.addional) {
			channels = channels.concat(activeEvent.rooms!.voice!.addional!);
		}

		for (const ch of channels) {
			const channel = guild.channels.cache.get(ch!) as VoiceChannel;
			members = members.concat(channel!.members.array());
		}

		const firstChannel = guild.channels.cache.get(
			config.IDS.CHANNELIDS.hangoutChannelID
		)! as VoiceChannel;
		const secondChannel = guild.channels.cache.get(
			config.IDS.CHANNELIDS.insomniaChannelID
		)! as VoiceChannel;

		const freePlacesF = firstChannel.userLimit - firstChannel.members.size;
		const freePlacesS =
			secondChannel.userLimit - secondChannel.members.size;

		for (let member of members) {
			try {
				switch (true) {
					case freePlacesF >= members.length:
						await member.voice.setChannel(firstChannel);
						break;
					case freePlacesS >= members.length:
						await member.voice.setChannel(secondChannel);
						break;
					default:
						await member.voice.setChannel(null);
						break;
				}
			} catch (err) {
				const index = activeEvent.membersData.findIndex(
					(key) => key.uid === member.id
				);

				if (index === Number("-1")) return;

				const data = activeEvent.membersData[index];

				if (data.joinDate) {
					const mins = FUNCS.getMins(checkDate - data.joinDate);
					const totalMins = data.totalMins + mins;

					await activeEvents.updateOne(
						{
							master: activeEvent.master,
							"membersData.uid": member.id,
						},
						{
							$set: {
								"membersData.$.joinDate": null,
								"membersData.$.totalMins": totalMins,
							},
						}
					);
				}
			}
		}

		await FUNCS.sleep(1000);
	},
	addMasterToJournal: async (memberId: string, guild: Guild) => {
		const journalChannel = guild.channels.cache.get(
			config.IDS.CHANNELIDS.journalChannelID
		) as TextChannel;

		journalChannel.updateOverwrite(memberId, {
			VIEW_CHANNEL: true,
		});
	},
	removeMasterFromJournal: async (memberId: string, guild: Guild) => {
		const journalChannel = guild.channels.cache.get(
			config.IDS.CHANNELIDS.journalChannelID
		) as TextChannel;

		const perms = journalChannel.permissionOverwrites.find(
			(p) => p.type === "member" && p.id === memberId
		);

		if (perms) perms.delete();
	},
};

export default FUNCS;
