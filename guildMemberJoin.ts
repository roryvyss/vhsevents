import { MessageEmbed } from "discord.js";
import { IEvent, FUNCS, config } from "../settings/utils";

const event: IEvent<"guildMemberAdd"> = {
	name: "guildMemberAdd",
	run: async (member) => {
		if (member.guild.id != config.IDS.GUILDID) return;
		const logChannel = FUNCS.getLogChannel(member.guild);

		const embed = new MessageEmbed()
			.setColor("PURPLE")
			.setTitle(`Новый участник!`)
			.setDescription(`${member.toString()} присоединился к нам`)
			.setFooter(`ID: ${member.id}`)
			.setTimestamp(new Date());

		logChannel.send(embed);
	},
};

export default event;
