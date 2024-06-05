import { MessageReaction, User } from "discord.js";
import { eventsModel } from "../../db/models/eventsModel";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивудалить",
	category: "Events",
	desc: "Команда для удаления ивента в базе",
	cooldown: 2,
	usage: config.PREFIX + "ивудалить eventName",
	permission: "EventCurator",
	run: async (client, args, msg) => {
		const eventName = args.join(" ");

		if (msg.member?.roles.cache.some(r => [config.IDS.ROLEIDS.SupportRoleID, config.IDS.ROLEIDS.ModeratorRoleID].includes(r.id))) return

		const isExist = await eventsModel.findOne({
			name: eventName,
		});

		if (!isExist) {
			return msg.reply(`Такого ивента не существует`);
		}

		const sentMsg = await msg.channel.send(
			`Вы действительно хотите удалить ивент **${eventName}**?`
		);
		const allowedReactions = ["✅", "❌"];

		for (const emote of allowedReactions) {
			await sentMsg.react(emote);
		}

		const filter = (reaction: MessageReaction, user: User) => {
			return (
				allowedReactions.includes(reaction.emoji.name) &&
				user.id === msg.author.id
			);
		};

		const coll = await sentMsg.awaitReactions(filter, {
			max: 1,
			time: 600000,
		});
		const reaction = coll.first();

		switch (reaction?.emoji.name) {
			case "✅":
				await eventsModel.deleteOne({
					name: eventName,
				});
				msg.channel.send(`Ивент **${eventName}** удален`);
				break;
			case "❌":
				msg.channel.send(`Вы отменили процесс удаления ивента`);
				break;
		}
	},
};

export default cmd;
