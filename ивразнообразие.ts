import { configModel } from "../../db/models/configsModel";
import { masterModel } from "../../db/models/masterProfile";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивразнообразие",
	category: "Events",
	desc: "Команда для редактирования нормы разнообразия в неделю",
	cooldown: 2,
	usage: config.PREFIX + "ивразнообразие",
	permission: "EventCurator",
	run: async (client, args, msg) => {
		if (msg.member?.roles.cache.some(r => [config.IDS.ROLEIDS.SupportRoleID, config.IDS.ROLEIDS.ModeratorRoleID].includes(r.id))) return

		const number = Number(args[0]);
		if (!number || isNaN(number) || number <= 0) {
			return msg.channel
				.send(
					`Вам нужно указать правильное число, которое будет больше 0`
				)
				.then((m) => m.delete({ timeout: 10000 }));
		}
		await configModel.updateOne(
			{
				guildId: msg.guild!.id,
			},
			{
				varietyRate: number,
			}
		);
		msg.channel
			.send(`Вы успешно изменили норму разнообразия на **${number}**`)
			.then((m) => m.delete({ timeout: 10000 }));
	},
};

export default cmd;
