import { MessageEmbed } from "discord.js";
import { IEvent, FUNCS, config } from "../settings/utils";

const event: IEvent<"roleUpdate"> = {
	name: "roleUpdate",
	run: async (oldRole, newRole) => {
		const logChannel = FUNCS.getLogChannel(newRole.guild);

		if ((oldRole.guild.id || newRole.guild.id) != config.IDS.GUILDID)
			return;
		if (oldRole.name === newRole.name) return;

		const embed = new MessageEmbed()
			.setColor("PURPLE")
			.setDescription(`Роль отредактирована\n> ${newRole.toString()}`)
			.addField(
				"Название",
				`**old**: \`${oldRole.name}\`\n**new**: \`${newRole.name}\``
			)
			.setFooter(`ID: ${newRole.id}`)
			.setTimestamp(new Date());

		await logChannel.send(embed);
	},
};

export default event;
