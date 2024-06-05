import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "test2",
	category: "Dev",
	desc: "asd",
	cooldown: 2,
	usage: config.PREFIX + "test2",
	permission: "Admin",
	run: async (client, args, msg) => {
		msg.channel
			.send({
				embed: config.EMBEDS.pannelEmbed,
			})
			.then((m) => m.react("🟡"));
	},
};

export default cmd;
