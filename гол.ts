import { MessageEmbed, MessageReaction, User } from "discord.js";
import { activeEvents } from "../../db/models/activeEvents";
import FUNCS from "../../settings/functions";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "гол",
	category: "Events",
	desc: "Команда для выдачи доп баллов ведущему",
	cooldown: 2,
	usage: config.PREFIX + "гол",
	permission: "User",
	run: async (client, args, msg) => {
		msg.delete()
		const activeEvent = await activeEvents.findOne({
			$or: [
				{
					"rooms.text.main": msg.channel.id,
				},
				{
					"rooms.text.addional": msg.channel.id,
				},
			],
		});

		if (!activeEvent) return;
		if (activeEvent.master === msg.author.id) {
			msg.reply(`Вы не можете выдать сами себе балл.`).then((m) =>
				m.delete({ timeout: 10000 })
			);
			return;
		}

		const pointsEntry = activeEvent!.points!.find(
			(entry) => entry.uid === msg.author.id
		);

		if (pointsEntry) {
			msg.reply(
				`Вы уже дали балл этому ведущему. Ваш балл: \`${pointsEntry.point}\``
			).then((m) => m.delete({ timeout: 10000 }));
			return;
		}

		const memberData = activeEvent.membersData.find(
			(entry) => entry.uid === msg.author.id
		);
		if (!memberData) return;

		const totalMins = memberData.totalMins;
		const getMins = FUNCS.getMins(
			new Date().getTime() - memberData.joinDate!
		);

		if (totalMins < 5 && getMins + totalMins < 5) {
			msg.reply(`Вам нужно провести больше **5** минут на ивенте`).then(
				(m) =>
					m.delete({
						timeout: 10000,
					})
			);
			return;
		}

		const point = Number(args[0]);
		if (isNaN(point) || ![1, 2, 3, 4, 5].includes(point)) {
			msg.reply(
				`Вы указали неверный балл, вам нужно указать балл от **1** до **5**.`
			).then((m) => m.delete({ timeout: 10000 }));
			return;
		}

		activeEvent.points?.push({
			uid: msg.author.id,
			point,
		});

		await activeEvents.updateOne(
			{
				_id: activeEvent._id,
			},
			activeEvent
		);
		msg.reply(
			`Вы дали ведущему **${point}** баллов за этот ивент <a:done:633677830907101216>`
		).then((m) => m.delete({ timeout: 5000 }));
	},
};

export default cmd;
