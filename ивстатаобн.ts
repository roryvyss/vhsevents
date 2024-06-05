import { starsFromEventModel } from "../../db/models/starsFromEventModel";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивстатаобн",
	category: "Events",
	desc: 'Команда для обнуления "звёздной" статы за ивенты',
	cooldown: 2,
	usage: config.PREFIX + "ивстатаобн",
	permission: "JunAdm",
	run: async (client, args, msg) => {
		await starsFromEventModel.collection.drop();
		msg.channel.send(`Вы успешно обнулили статистику`);
	},
};

export default cmd;
