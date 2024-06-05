import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "помощь",
	category: "General",
	desc: "хэлп",
	cooldown: 2,
	usage: config.PREFIX + "помощь",
	permission: "User",
	run: async (client, args, msg) => {},
};

export default cmd;
