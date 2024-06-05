import { MessageEmbed } from "discord.js";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "test",
	category: "Dev",
	desc: "test",
	cooldown: 2,
	usage: config.PREFIX + "test",
	permission: "Dev",
	run: async (client, args, msg) => {
		const embed = new MessageEmbed()
		for (let i = 0; i < 2; i++) {
			if (i === 0) embed.setTitle(`Месячная стата`)
			if (i === 1) embed.setTitle(`Недельная стата`)
			msg.channel.send(embed);
		}
	},
};

export default cmd;
