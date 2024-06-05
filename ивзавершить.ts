import {
	MessageReaction,
	User,
	TextChannel,
	Guild,
	GuildMember,
	VoiceChannel,
} from "discord.js";
import { activeEvents, IActiveEventSchema } from "../../db/models/activeEvents";
import { masterModel } from "../../db/models/masterProfile";
import { ICOMMAND, config, FUNCS, customCooldown } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивзавершить",
	category: "Events",
	desc: "Команда для завершения ивента",
	cooldown: 2,
	usage: config.PREFIX + "ивзавершить",
	permission: "User",
	run: async (client, args, msg) => {
		let activeEvent = await activeEvents.findOne({
			master: msg.author.id,
		});

		if (!activeEvent) {
			return await msg.delete();
		}

		const winners = msg.mentions.members?.array();
		const journalChannel = msg.guild?.channels.cache.get(
			config.IDS.CHANNELIDS.journalChannelID
		) as TextChannel;

		if (!winners?.length) {
			msg.channel
				.send(`Вы не указали победителей ивента, нужно упомянуть их.`)
				.then((m) => m.delete({ timeout: 10000 }));
			return await msg.delete();
		}

		if (activeEvent.delayedLaunch && activeEvent.delayedLaunch.stage != 1) {
			msg.channel
				.send(`Вы не можете завершить ивент, который еще не проводился`)
				.then((m) => m.delete({ timeout: 10000 }));
			return;
		}

		const emojis = ["✅", "❎"];
		const filter = (reaction: MessageReaction, user: User) => {
			return (
				emojis.includes(reaction.emoji.name) &&
				user.id === msg.author.id
			);
		};
		const sentMsg = await msg.channel.send(
			`Вы уверены что хотите завершить ивент **${activeEvent.event.name}**?`
		);

		for (const emote of emojis) {
			await sentMsg.react(emote);
		}

		const collected = await sentMsg.awaitReactions(filter, {
			max: 1,
			time: 60000,
		});
		const reaction = collected.first();

		if (!reaction) {
			await sentMsg.delete();
			return await msg.delete();
		}

		switch (reaction.emoji.name) {
			case "✅":
				try {
					await msg.member?.setNickname("");
				} catch (err) {}

				await FUNCS.lockEventChannels(activeEvent, msg.guild!);
				await FUNCS.moveMembers(activeEvent, msg.guild!);

				activeEvent = await activeEvents.findOne({
					_id: activeEvent._id,
				});

				let masterProf = await masterModel.findOne({
					uid: msg.author.id,
				});

				if (!activeEvent?.startedByTimedMaster) {
					await FUNCS.rewardWinners(activeEvent!, winners, msg);
				} else {
					customCooldown.set(msg.author.id, {
						id: msg.author.id,
						time: new Date().getTime() + 1000 * 60 * 30,
					});

					const week = 1000 * 60 * 60 * 24 * 7;
					if (!masterProf) {
						FUNCS.addMasterToJournal(msg.author.id, msg.guild!)
						masterProf = await masterModel.create({
							uid: msg.author.id,
							lvl: 0,
							xp: 0,
							starsEarned: 0,
							completedEvents: [],
							weekRatings: [],
							weekStats: {
								weekEvents: [],
								points: 0,
								minutesOnEvent: 0,
								starsEarned: 0,
								peopleOnEvent: 0,
								messagesOnEvent: 0,
							},
							masterSince: new Date().getTime(),
							removeProfileTime: new Date().getTime() + week,
						});
					} else {
						await masterModel.updateOne(
							{
								uid: msg.author.id,
							},
							{
								removeProfileTime: new Date().getTime() + week,
							}
						);
					}
				}

				if (masterProf) {
					await FUNCS.updateMasterProfile(activeEvent!, msg, true);
				}

				await FUNCS.endEvent(
					msg,
					activeEvent!,
					journalChannel,
					winners,
					true
				);

				FUNCS.getEventChannelsAndDelete(activeEvent!, msg.guild!);
				break;
			case "❎":
				await msg.delete();
				await sentMsg.delete();
				break;
		}
	},
};

export default cmd;
