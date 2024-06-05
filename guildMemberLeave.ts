import { MessageEmbed, TextChannel } from "discord.js";
import { masterModel } from "../db/models/masterProfile";
import { IEvent, FUNCS, config } from "../settings/utils";

const event: IEvent<"guildMemberRemove"> = {
	name: "guildMemberRemove",
	run: async (member, client) => {
		if (member.guild.id != config.IDS.GUILDID) return;
		const guild = client.guilds.cache.get("508698707861045248")!;

		if (member.id) {
			const master = await masterModel.findOne({
				uid: member.id,
			});

			if (master) {
				await masterModel.deleteOne({
					uid: member.id,
				});
				const _ = guild.channels.cache.get(
					config.IDS.CHANNELIDS.adminStatsChannelID
				) as TextChannel;
				const masterMessage = await _.messages.fetch(
					master.profileMessage!
				);

				if (masterMessage) await masterMessage.delete();
				if (master.removeProfileTime) {
					FUNCS.removeMasterFromJournal(master.uid, guild);
				}
			}
		}

		const logChannel = FUNCS.getLogChannel(guild!);

		const embed = new MessageEmbed()
			.setColor("PURPLE")
			.setTitle(`Участник покинул нас!`)
			.setDescription(`${member.toString()} вышел с сервера`)
			.setFooter(`ID: ${member.id}`)
			.setTimestamp(new Date());

		logChannel.send(embed);
	},
};

export default event;
