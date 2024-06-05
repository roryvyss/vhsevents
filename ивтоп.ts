import { MessageEmbed } from "discord.js";
import { starsFromEventModel } from "../../db/models/starsFromEventModel";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивтоп",
	category: "Events",
	desc: "Команда для отображения топа участников, которые больше всего заработали звёзд за ивенты",
	cooldown: 2,
	usage: config.PREFIX + "ивтоп ивенты",
	permission: "User",
	run: async (client, args, msg) => {
		let starsEearned = await starsFromEventModel.find();

		if (args[0] && args[0] === "ивенты") {
			starsEearned = starsEearned.filter((en) => !en.uid);

			starsEearned.sort((a, b) => {
				return b.totalStars! - a.totalStars!;
			});
			const desc = starsEearned
				.map(
					(entry, index) =>
						`\`#${index + 1}\` ${entry.eventName} - ${
							entry.totalStars
						}`
				)
				.join("\n");
			const embed = new MessageEmbed().setDescription(
				`Сколько люди получили за тот или иной ивент звёзд\n\n${desc}`
			);
			msg.channel.send(embed);
		} else {
			starsEearned = starsEearned.filter((en) => en.uid);
			const plussedArray: ITest[] = starsEearned.map((entry) => {
				const totalStars = entry.eventsData
					.map((_) => _.totalStars)
					.reduce((first, second) => {
						return first + second;
					});
				return { uid: entry.uid, totalStars };
			});

			plussedArray.sort((a, b) => {
				return b.totalStars - a.totalStars;
			});

			const desc = plussedArray
				.slice(0, 10)
				.map(
					(entry, index) =>
						`\`#${index + 1}\` <@${entry.uid}> - ${
							entry.totalStars
						}`
				)
				.join("\n");
			const embed = new MessageEmbed().setDescription(
				`Топ 10 пользователей, который заработали больше всех звёзд за ивенты:\n\n${desc}`
			);
			msg.channel.send(embed);
		}
	},
};

interface ITest {
	uid: string;
	totalStars: number;
}

export default cmd;
