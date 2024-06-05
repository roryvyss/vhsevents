import {
	MessageReaction,
	User,
	TextChannel,
	GuildMember,
	Message,
	VoiceChannel,
} from "discord.js";
import moment from "moment";
import { activeEvents, IActiveEventSchema } from "../../db/models/activeEvents";
import { ICOMMAND, config, FUNCS } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивновая",
	category: "Events",
	desc: "Команда для завершения ивента, без удаления каналов",
	cooldown: 2,
	usage: config.PREFIX + "ивновая @winners",
	permission: "EventMaster",
	run: async (client, args, msg) => {
		let activeEvent = await activeEvents.findOne({
			master: msg.author.id,
		});

		const winners = msg.mentions.members?.array();
		const journalChannel = msg.guild?.channels.cache.get(
			config.IDS.CHANNELIDS.journalChannelID
		) as TextChannel;

		if (!activeEvent) {
			return await msg.delete();
		}

		if (!winners?.length) {
			msg.channel
				.send(`Вы не указали победителей ивента, нужно упомянуть их.`)
				.then((m) => m.delete({ timeout: 5000 }));
			return await msg.delete();
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
			return msg.delete();
		}

		switch (reaction.emoji.name) {
			case "✅":
				await FUNCS.rewardWinners(activeEvent, winners, msg);
				await checkMinutes(activeEvent, msg);

				activeEvent = await activeEvents.findOne({
					_id: activeEvent._id,
				});

				await FUNCS.updateMasterProfile(activeEvent!, msg);
				await FUNCS.endEvent(
					msg,
					activeEvent!,
					journalChannel,
					winners
				);

				await sentMsg.delete();
				await msg.delete();
				break;
			case "❎":
				await msg.delete();
				await sentMsg.delete();
				break;
		}
	},
};

async function checkMinutes(activeEvent: IActiveEventSchema, msg: Message) {
	const checkDate = new Date().getTime();

	let members: GuildMember[] = [];
	let channels = [activeEvent.rooms!.voice!.main];
	activeEvent.rooms?.voice?.addional
		? (channels = channels.concat(activeEvent.rooms.voice.addional))
		: null;

	for (const channel of channels) {
		const voiceChannel = msg.guild?.channels.cache.get(
			channel
		) as VoiceChannel;

		if (voiceChannel.members.size) {
			const array = voiceChannel.members.array();

			members = members.concat(array);
		}
	}

	for (const member of members) {
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

	await FUNCS.sleep(1000);
}

export default cmd;
