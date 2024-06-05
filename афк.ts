import { afkModel } from "../../db/models/afkModel";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "афк",
	category: "General",
	desc: 'Команда для установки статуса "AFK"',
	cooldown: 2,
	usage: config.PREFIX + "афк",
	permission: "User",
	run: async (client, args, msg) => {
		if (msg.mentions.members?.size || msg.mentions.roles.size) {
			return msg.reply(
				`Вы не можете установить **AFK** в котором будет упоминание роли или участника`
			);
		}

		const text = args.join(" ");

		const createObj: {
			userId: string;
			message?: string;
			time: number;
		} = {
			userId: msg.author.id,
			time: new Date().getTime(),
		};

		text ? (createObj.message = text) : undefined;

		try {
			await afkModel.create(createObj);
			msg.reply(
				`Вы успешно установили **AFK** статус${
					text ? ` с текстом\n${text}` : ""
				}`
			).then((m) => m.delete({ timeout: 10000 }));
		} catch (err) {
			console.log(err);
			console.log(`Ошибка во время записи юзера в бд в комманде "AFK"`);
			msg.reply(`Произошла ошибка`);
		}
	},
};

export default cmd;
