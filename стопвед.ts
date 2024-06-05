import { mastersBlacklistModel } from "../../db/models/mastersBlacklist";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "стопвед",
	category: "Events",
	desc: "Команда что бы добавить юзера в ЧС временных ведущий",
	cooldown: 2,
	usage: config.PREFIX + "стопвед userID",
	permission: "User",
	run: async (client, args, msg) => {
		const userID = msg.mentions.members?.first() || args[0];
		if (!userID) {
			return msg
				.reply(
					`Вы не указали **ID** пользователя, или забыли его упомянуть`
				)
				.then((m) => m.delete({ timeout: 5000 }));
		}

		try {
			let member =
				typeof userID === "string"
					? await msg.guild?.members.fetch(userID)
					: userID;
			const alreadyExist = await mastersBlacklistModel.findOne({
				uid: member?.id,
			});

			if (alreadyExist) {
				return msg.reply(`Этот участник уже есть в чёрном списке`);
			} else {
				await mastersBlacklistModel.create({
					uid: member?.id,
				});
				return msg.reply(
					`Участник с **ID** \`${userID}\` был успешно добавлен в ЧС временных ведущих.`
				);
			}
		} catch (err) {
			return msg.reply(
				`Участника с **ID** \`${userID}\` не было найдено на сервере.`
			);
		}
	},
};

export default cmd;
