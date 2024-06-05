import { mastersBlacklistModel } from "../../db/models/mastersBlacklist";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "плюсвед",
	category: "Events",
	desc: "Команда что бы убрать юзера из ЧС временных ведущий",
	cooldown: 2,
	usage: config.PREFIX + "плюсвед userID",
	permission: "User",
	run: async (client, args, msg) => {
		const userID = args[0];
		if (!userID) {
			return msg
				.reply(
					`Вы не указали **ID** участника которого хотите убрать из ЧС`
				)
				.then((m) => m.delete({ timeout: 5000 }));
		}

		try {
			const member = await msg.guild?.members.fetch(userID);

			const exist = await mastersBlacklistModel.findOne({
				uid: userID,
			});

			if (!exist) {
				return msg.reply(
					`Участника с **ID** \`${userID}\` нет в чёрном списке временных ведущих`
				);
			} else {
				await mastersBlacklistModel.deleteOne({
					uid: userID,
				});

				return msg.reply(
					`Участник с **ID** \`${userID}\` был удалён из ЧС временных ведущих`
				);
			}
		} catch (err) {
			return msg.reply(
				`Участник с **ID** \`${userID}\` не был найден на сервере`
			);
		}
	},
};

export default cmd;
