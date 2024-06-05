import {
	CategoryChannel,
	Guild,
	GuildChannel,
	TextChannel,
	MessageEmbed,
	VoiceChannel,
} from "discord.js";
import * as moment from "moment";
import { config, customCooldown, FUNCS, IEvent } from "../settings/utils";
import { schedule } from "node-cron";
import { activeEvents, IActiveEventSchema } from "../db/models/activeEvents";
import { masterModel } from "../db/models/masterProfile";
import { configModel } from "../db/models/configsModel";
import { userModel } from "../db/models/usersModel";

const emojis = {
	0: "👑",
	1: "🥈",
	2: "🥉",
};

const event: IEvent<"ready"> = {
	name: "ready",
	run: async (client) => {
		console.log(`${client.user?.username} is ready.`);

		const guild = client.guilds.cache.get(config.IDS.GUILDID)!;

		schedule(
			"*/30 * * * * *",
			() => {
				customCooldown.forEach((el) => {
					if (el.time <= new Date().getTime()) {
						customCooldown.delete(el.id);
					}
				});
				removeTimedMasters(guild);
				handleDelayedEventLaunch(guild);
				sortChannels(guild);
			},
			{
				timezone: "Europe/Moscow",
			}
		);

		schedule(
			"0 12 * * 6",
			() => {
				calcWeeklyAndMontlyStats(guild);
			},
			{
				timezone: "Europe/Moscow",
			}
		);
	},
};

async function removeTimedMasters(guild: Guild) {
	const masters = await masterModel.find({
		removeProfileTime: {
			$lt: new Date().getTime(),
		},
	});

	if (!masters.length) return;

	const _ = guild.channels.cache.get(
		config.IDS.CHANNELIDS.adminStatsChannelID
	) as TextChannel;

	for (const master of masters) {
		FUNCS.removeMasterFromJournal(master.uid, guild);
		await masterModel.deleteOne({
			uid: master.uid,
		});
		const masterMessage = await _.messages.fetch(master.profileMessage!);
		await masterMessage.delete();
	}
}

async function handleDelayedEventLaunch(guild: Guild) {
	const events = await activeEvents.find();

	if (!events.length) return;

	for (const activeEvent of events) {
		switch (activeEvent.startType) {
			case 1:
				firstTypeEvent(activeEvent, guild);
				break;
			case 2:
				secondTypeEvent(activeEvent, guild);
				break;
			case 3:
				thirdTypeEvent(activeEvent, guild);
				break;
		}
	}
}

async function calcWeeklyAndMontlyStats(guild: Guild) {
	const weekLeaderboard: ILeaderboard[] = [];
	const monthLeaderboard: ILeaderboard[] = [];

	const ch = guild.channels.cache.get("651058403614916629") as TextChannel;

	const masters = await masterModel.find();
	if (!masters.length) return;

	const sortedMasters = masters
		.filter((m) => m.removeProfileTime === undefined)
		.sort((a, b) => {
			return b.weekRatings.length - a.weekRatings.length;
		});

	const week = sortedMasters[0].weekRatings.length;

	for (const master of masters) {
		const masterRate = master.weekStats.weekEvents.length
			? master.weekStats.weekEvents
					.map((event) => event.timesDone)
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

		const weekRating = FUNCS.calcWeekRating(master);
		const pay =
			varietyRate! > 4
				? masterRate * 50 + (varietyRate! - 4) * 50
				: masterRate * 50;

		if (!master.removeProfileTime) {
			await userModel.updateOne(
				{ userId: master!.uid },
				{ $inc: { Currency: pay } },
				{ upsert: true, setDefaultsOnInsert: true }
			);
		}

		switch (week) {
			case 5:
				let celery = 0,
					rating = 0,
					variety = 0,
					starsEarned = 0,
					weekEvents = 0,
					minutesOnEvent = 0,
					peopleOnEvent = 0,
					messagesOnEvent = 0;

				master.weekRatings.map((elem) => {
					rating += elem.rating;
					celery += elem.celery;
					variety += elem.variety;
					starsEarned += elem.starsEarned;
					minutesOnEvent += elem.minutesOnEvent;
					peopleOnEvent += elem.peopleOnEvent;
					messagesOnEvent += elem.messagesOnEvent;
					weekEvents += elem.weekEvents.length
						? elem.weekEvents
								.map((_) => {
									return _.timesDone;
								})
								.reduce((first, second) => {
									return first + second;
								})
						: 0;
				});

				monthLeaderboard.push({
					uid: master.uid,
					celery,
					weekEvents,
					variety,
					starsEarned,
					minutesOnEvent,
					rating,
					peopleOnEvent,
					messagesOnEvent,
				});
				master.weekRatings = [];
				break;
			default:
				master.weekRatings.push({
					rating: weekRating,
					weekEvents: master.weekStats.weekEvents,
					celery: pay,
					variety: varietyRate!,
					starsEarned: master.weekStats.starsEarned,
					minutesOnEvent: master.weekStats.minutesOnEvent,
					peopleOnEvent: master.weekStats.peopleOnEvent,
					messagesOnEvent: master.weekStats.messagesOnEvent,
				});
				break;
		}

		weekLeaderboard.push({
			uid: master.uid,
			rating: weekRating,
			celery: pay,
			variety: varietyRate!,
			starsEarned: master.weekStats.starsEarned,
			minutesOnEvent: master.weekStats.minutesOnEvent,
			peopleOnEvent: master.weekStats.peopleOnEvent,
			weekEvents: masterRate,
			messagesOnEvent: master.weekStats.messagesOnEvent,
		});

		master.weekStats = {
			weekEvents: [],
			points: 0,
			minutesOnEvent: 0,
			starsEarned: 0,
			peopleOnEvent: 0,
			messagesOnEvent: 0,
		};

		await masterModel.updateOne(
			{
				_id: master._id,
			},
			master
		);
	}

	if (monthLeaderboard.length) {
		const sortedMembers = monthLeaderboard.sort((a, b) => {
			return b.rating - a.rating;
		});

		const filteredArray: ILeaderboard[] = await filterMembers(
			sortedMembers,
			guild
		);

		await genEmb(filteredArray, guild);
	} else if (weekLeaderboard.length) {
		const sortedMembers = weekLeaderboard.sort((a, b) => {
			return b.rating - a.rating;
		});

		const filteredArray: ILeaderboard[] = await filterMembers(
			sortedMembers,
			guild
		);

		await genEmb(filteredArray, guild, true);
	}

	FUNCS.updEmbedStats(guild);
}

async function filterMembers(array: ILeaderboard[], guild: Guild) {
	const returnArray: ILeaderboard[] = [];

	for (let i = 0; i < array.length; i++) {
		const elem = array[i];

		try {
			const member = await guild.members.fetch(elem.uid);
			if (
				!member.roles.cache.has(config.IDS.ROLEIDS.EventMasterRoleID) &&
				elem.weekEvents < 1
			) {
				continue;
			}
			returnArray.push(elem);
		} catch (err) {}
	}

	return returnArray;
}

async function firstTypeEvent(activeEvent: IActiveEventSchema, guild: Guild) {
	if (!activeEvent.startedByTimedMaster) {
		return;
	}

	if (activeEvent.announceMsgId) {
		return;
	}

	const ms = new Date().getTime() - activeEvent.eventStarted;
	const minutes = getMinutes(ms);
	const voiceChannel = guild.channels.cache.get(
		activeEvent.rooms!.voice!.main
	) as VoiceChannel;
	const logChannel = guild.channels.cache.get(
		config.IDS.CHANNELIDS.eventsLogsChannelID
	) as TextChannel;

	if (
		voiceChannel.members.has(activeEvent.master) &&
		!activeEvent.announceMsgId
	) {
		const announceChannel = guild.channels.cache.get(
			config.IDS.CHANNELIDS.eventAnnounceChannelID
		) as TextChannel;
		const announceMessage = await announceChannel.send({
			embed: activeEvent.startedByTimedMaster.announceEmbed,
		});

		await activeEvents.updateOne(
			{
				master: activeEvent.master,
			},
			{
				$set: {
					announceMsgId: announceMessage.id,
				},
			}
		);
		return;
	}

	if (
		minutes >= 2 &&
		voiceChannel.members.size === 0 &&
		!activeEvent.announceMsgId
	) {
		const embed = new MessageEmbed().setDescription(
			`Временный ведущий <@${activeEvent.master}> запустил ивент **${activeEvent.event.name}** и не пришел на него. Ивент был автоматически остановлен.`
		);
		logChannel.send(embed);
		await activeEvents.deleteOne({
			master: activeEvent.master,
		});
		return FUNCS.getEventChannelsAndDelete(activeEvent, guild);
	}
}

async function secondTypeEvent(activeEvent: IActiveEventSchema, guild: Guild) {
	if (activeEvent.delayedLaunch && activeEvent.delayedLaunch.stage === 1) {
		return;
	}

	const ms = activeEvent.delayedLaunch!.startIn - new Date().getTime();
	const minutes = getMinutes(ms);
	const voiceChannel = guild.channels.cache.get(
		activeEvent.rooms!.voice!.main
	) as VoiceChannel;
	const member = await guild.members.fetch(activeEvent.master);

	if (minutes <= 5 && minutes > 1) {
		const reminder = new MessageEmbed()
			.setColor("PURPLE")
			.setDescription(
				`Напоминаю, вы создали ивент **${
					activeEvent.event.name
				}**, и отложили его запуск на **${
					activeEvent.delayedLaunch!.minutes
				}** минут.` +
					`\nДо старта ивента осталось **${minutes}** минут, вам нужно скорее зайти в ${voiceChannel.toString()}`
			);
		try {
			await member.user.send(reminder);
		} catch (err) {}
	} else if (minutes < 1) {
		const error = new MessageEmbed()
			.setColor("PURPLE")
			.setDescription(
				`${member.toString()} запустил ивент **${
					activeEvent.event.name
				}**, и отложил его запуск на **${
					activeEvent.delayedLaunch!.minutes
				} минут**.` + `\nНо так и не пришел на него.`
			);
		const eventLogChannel = guild.channels.cache.get(
			config.IDS.CHANNELIDS.eventsLogsChannelID
		) as TextChannel;
		const sendMemberError = new MessageEmbed()
			.setColor("PURPLE")
			.setDescription(
				`Вы запустили отложенный запуск ивента **${activeEvent.event.name}** но не пришли до начала и ивент не был запущен.`
			);
		eventLogChannel.send(error);
		try {
			const announceChannel = guild.channels.cache.get(
				config.IDS.CHANNELIDS.eventAnnounceChannelID
			) as TextChannel;
			const announcheMsg = await announceChannel.messages.fetch(
				activeEvent.announceMsgId
			);
			announcheMsg.delete();
			await member.user.send(sendMemberError);
			await voiceChannel.delete();
			await activeEvents.deleteOne({
				_id: activeEvent._id,
			});
		} catch (err) {}
	}
}

async function thirdTypeEvent(activeEvent: IActiveEventSchema, guild: Guild) {
	if (activeEvent.delayedLaunch && activeEvent.delayedLaunch.stage === 1) {
		return;
	}

	const ms = activeEvent.delayedLaunch!.startIn! - new Date().getTime();
	const minutes = getMinutes(ms);
	const member = await guild.members.fetch(activeEvent.master);

	const eventLogChannel = guild.channels.cache.get(
		config.IDS.CHANNELIDS.eventsLogsChannelID
	) as TextChannel;
	const eventAnnounceChannel = guild.channels.cache.get(
		config.IDS.CHANNELIDS.eventAnnounceChannelID
	) as TextChannel;
	const announceMsg = await eventAnnounceChannel.messages.fetch(
		activeEvent.delayedLaunch!.lobby?.messageId!
	);

	if (activeEvent.rooms) {
		if (minutes <= 0) {
			const error = new MessageEmbed()
				.setColor("PURPLE")
				.setDescription(
					`Ивент **${
						activeEvent.event.name
					}** набрал нужное кол-во участников, но ведущий ${member.toString()} не зашел в войс в течении **10** минут`
				);
			FUNCS.getEventChannelsAndDelete(activeEvent, guild);
			eventLogChannel.send(error);
			announceMsg.delete();
			try {
				await member.send(
					`Вы запустили отложенный запуск ивента **${activeEvent.event.name}** но не пришли до начала и ивент не был запущен.`
				);
			} catch (err) {}
			await activeEvents.deleteOne({
				_id: activeEvent._id,
			});
		}
	} else {
		if (minutes <= 0) {
			const error = new MessageEmbed()
				.setColor("PURPLE")
				.setDescription(
					`Ивент **${activeEvent.event.name}** запущенный <@${
						activeEvent.master
					}> не набрал нужное кол-во участников **(${
						activeEvent.delayedLaunch?.lobby?.players.length
					}/${activeEvent.slots})** за **${
						activeEvent.delayedLaunch!.minutes
					}** минут`
				);
			eventLogChannel.send(error);
			announceMsg.delete();
			await activeEvents.deleteOne({
				_id: activeEvent._id,
			});
		}
	}
}

async function sortChannels(guild: Guild) {
	const category = guild.channels.cache.get(
		config.IDS.CHANNELIDS.privateChannelsCatID
	) as CategoryChannel;
	const channelToFilter =
		config.IDS.CHANNELIDS.channelToFilterInPrivateChannels;

	const channels =
		category.children != undefined
			? channelToFilter
				? category.children.filter(
						(channel) =>
							channel.id != channelToFilter &&
							channel.type != "text"
				  )
				: category.children
			: undefined;

	let position = channelToFilter ? 1 : 0;
	const arr: IChannelArr[] = [];

	channels?.forEach((channel) => {
		arr.push({
			channel: channel,
			memberSize: channel.members.size,
		});
	});

	arr.sort((a, b) => {
		return b.memberSize! - a.memberSize!;
	}).forEach((entry) => {
		const voiceChannel = entry.channel as VoiceChannel;
		if (voiceChannel.position != position) {
			voiceChannel.setPosition(position);
		}
		position++;
	});
}

async function genEmb(array: ILeaderboard[], guild: Guild, week?: boolean) {
	const log = guild.channels.cache.get(
		config.IDS.CHANNELIDS.weekAndMonthReports
	) as TextChannel;

	const guildConfig = await configModel.findOne({
		guildId: guild.id,
	});

	const embed = new MessageEmbed()
		.setTitle(week ? "Недельный отчет" : "Месячный отчет")
		.setColor("YELLOW")
		.setImage(
			week
				? "https://i.imgur.com/UZH2jE8.png"
				: "https://i.imgur.com/iTgRsmI.png"
		);

	let desc = "";
	for (let i = 0; i < array.length; i++) {
		const elem = array[i];
		let user: string;
		try {
			user = (await guild.members.fetch(elem.uid)).user.username;
		} catch (err) {
			user = "👻";
		}

		const emoji = emojis[i] ? emojis[i] : "";
		const evRate =
			elem.weekEvents >= guildConfig!.eventRate
				? config.IDS.EMOJIS.YES
				: `**${elem.weekEvents}/${guildConfig!.eventRate}**`;
		const evVariety =
			elem.variety >= guildConfig!.varietyRate
				? config.IDS.EMOJIS.YES
				: `**${elem.variety}/${guildConfig!.varietyRate}**`;
		desc +=
			`${emoji} \`#${i + 1}\` <@${elem.uid}> (${user})${
				emoji === "👑"
					? ` - ${
							week
								? "Лучший ведущий недели"
								: "Лучший ведущий месяца"
					  }`
					: ""
			}` +
			`\n🔰Ив: **${elem.weekEvents}** ┃ ${
				guildConfig!.CurrencyLogo
			}ЗП: **${elem.celery}** ┃ Норма: ${evRate} ┃ Разн: ${evVariety}` +
			`\n\n👨: **${elem.peopleOnEvent}** ┃ 🔊: **${
				elem.minutesOnEvent
			}** мин. ┃ ✉: **${
				elem.messagesOnEvent ? elem.messagesOnEvent : 0
			}**` +
			`\n${
				emoji === "👑"
					? `\`\`\`fix\n[${elem.rating}]\`\`\``
					: `\`\`\`ini\n[${elem.rating}]\`\`\``
			}\n`;
		if (i && ((i + 1) % 7 === 0 || i === array.length - 1)) {
			log.send(embed.setDescription(desc));
			desc = "";
		}
	}
}

function getMinutes(time: number) {
	const duration = moment.duration(time);
	const minutes = duration.minutes();
	return minutes;
}

export default event;

interface IChannelArr {
	channel?: GuildChannel;
	memberSize?: number;
}

interface ILeaderboard {
	rating: number;
	uid: string;
	celery: number;
	variety: number;
	starsEarned: number;
	minutesOnEvent: number;
	peopleOnEvent: number;
	weekEvents: number;
	messagesOnEvent: number;
}
