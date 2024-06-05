import { MessageEmbed, TextChannel } from "discord.js";
import { activeEvents } from "../../db/models/activeEvents";
import { eventsModel } from "../../db/models/eventsModel";
import FUNCS from "../../settings/functions";
import { ICOMMAND, config } from "../../settings/utils";
import { timezone } from "strftime";

const cmd: ICOMMAND = {
	name: "ивстоп",
	category: "Events",
	desc: "Команда для остановки ивента, который не собрался",
	cooldown: 2,
	usage: config.PREFIX + "ивстоп",
	permission: "User",
	run: async (client, args, msg) => {
		let activeEvent = await activeEvents.findOne({
			master: msg.author.id,
		});
		let idToFind = msg.author.id;

		if (
			msg.member?.roles.cache.some((r) =>
				[
					config.IDS.ROLEIDS.AdminRoleID,
					config.IDS.ROLEIDS.JunAdminRoleID,
					config.IDS.ROLEIDS.EventCuratorRoleID,
				].includes(r.id)
			)
		) {
			idToFind = msg.mentions.members!.first()
				? msg.mentions.members!.first()!.id
				: args[0];

			activeEvent = await activeEvents.findOne({
				master: idToFind,
			});
		}

		if (!activeEvent) return msg.delete();

		if (!activeEvent.startedByTimedMaster) {
			await eventsModel.updateOne(
				{
					name: activeEvent.event.name,
				},
				{
					cooldown: {
						expireTime: new Date().getTime() + 60000 * 5,
						lastInvoker: msg.author.id,
					},
				}
			);
		}
		const announceChannel = msg.guild?.channels.cache.get(
			config.IDS.CHANNELIDS.eventAnnounceChannelID
		) as TextChannel;
		try {
			const announceMessage = await announceChannel.messages.fetch(
				activeEvent.announceMsgId
			);
			if (announceMessage.deletable) announceMessage.delete();
		} catch (err) {}

		const logChannel = msg.guild?.channels.cache.get(
			config.IDS.CHANNELIDS.eventsLogsChannelID
		) as TextChannel;

		await FUNCS.moveMembers(activeEvent, msg.guild!);
		FUNCS.getEventChannelsAndDelete(activeEvent!, msg.guild!);

		await FUNCS.sleep(1000);

		activeEvent = await activeEvents.findOne({ master: idToFind });

		await FUNCS.endEvent(msg, activeEvent!, logChannel, [], true, false);

		await activeEvents.deleteOne({
			master: idToFind,
		});

		const time = timezone(180);
		const embed = new MessageEmbed().setDescription(
			`<@${activeEvent!.master}> запустил **${
				activeEvent!.event.name
			}** в **${time(
				"%F %T",
				new Date(activeEvent!.eventStarted)
			)}** и завершил ивент в **${time("%F %T", new Date())}**)`
		);
		logChannel.send(embed);
	},
};

export default cmd;
