import {
	IEventMasterProfile,
	masterModel,
} from "../../db/models/masterProfile";
import { ICOMMAND, config, FUNCS } from "../../settings/utils";
import * as moment from "moment";
import { configModel } from "../../db/models/configsModel";

const cmd: ICOMMAND = {
	name: "ведущий",
	category: "Events",
	aliases: ["вед"],
	desc: "Команда для удаления ивента в базе",
	cooldown: 2,
	usage: config.PREFIX + "ведущий mention",
	permission: "User",
	run: async (client, args, msg) => {
		const member = msg.mentions.members?.first()
			? msg.mentions.members.first()
			: msg.member;

		const masterInfo = await masterModel.findOne({
			uid: member?.id,
		});

		if (!masterInfo) {
			return msg.channel
				.send(`Этот участник не ведущий`)
				.then((m) => m.delete({ timeout: 15000 }));
		}

		const totalEvents = masterInfo.completedEvents.length
			? masterInfo.completedEvents
					.map((completed) => completed.timesDone)
					.reduce((first, second) => {
						return first + second;
					})
			: 0;

		const favoriteEvent = masterInfo.completedEvents.sort(
			(a, b) => b.timesDone - a.timesDone
		)[0];

		const configs = await configModel.findOne({
			guildId: msg.guild!.id,
		});

		const weekRate = configs?.eventRate!;
		const weekVarietyRate = configs?.varietyRate!;

		const weekEventsDone = masterInfo.weekStats.weekEvents.length
			? masterInfo.weekStats.weekEvents
					.map((event) => event.timesDone)
					.reduce((first, second) => {
						return first + second;
					})
			: 0;
		let monthEventsDone = 0;

		for (const weekRating of masterInfo.weekRatings) {
			for (const event of weekRating.weekEvents) {
				monthEventsDone += event.timesDone;
			}
		}

		const weekRating = FUNCS.calcWeekRating(masterInfo);
		const monthRating = masterInfo.weekRatings.length
			? FUNCS.calcMonthRating(masterInfo) + weekRating
			: weekRating;

		const masterEmbed = {
			title: `<:1_:843527314670485574> ${member?.user.username}`,
			color: 16756224,
			description: `**Всего ивентов**:\n${masterInfo.completedEvents
				.map(
					(completed) =>
						`${completed.name}: \`${completed.timesDone}\``
				)
				.join("\n")}`,
			image: {
				url: "https://i.imgur.com/NcDIMC3.png",
			},
			fields: [
				{
					name: "<:7_:843531840853901352> **Ведущий уже**",
					value: `\`\`\`fix\n${masterSince(
						masterInfo.masterSince
					)}\n\`\`\``,
					inline: true,
				},
				{
					name: "<:7_:843531840853901352> **Всего ивентов**",
					value: `\`\`\`fix\n${totalEvents}\n\`\`\``,
					inline: true,
				},
				{
					name: "<:7_:843531840853901352> **Любимый ивент**",
					value: `\`\`\`fix\n${
						favoriteEvent ? favoriteEvent.name : "Нет"
					}\n\`\`\``,
					inline: true,
				},
				{
					name: "<:7_:843531840853901352> **Недельная норма**",
					value: `\`\`\`fix\n${calcWeekRate(
						masterInfo,
						weekRate
					)}\`\`\``,
					inline: true,
				},
				{
					name: "<:7_:843531840853901352> **Разнообразие**",
					value: `\`\`\`fix\n${calcVarietyRate(
						masterInfo,
						weekVarietyRate
					)}\n\`\`\``,
					inline: true,
				},
				{
					name: "<:7_:843531840853901352> **Нед/Мес**",
					value: `\`\`\`fix\nН: ${weekEventsDone} ┃ М: ${
						monthEventsDone + weekEventsDone
					}\n\`\`\``,
					inline: true,
				},
				{
					name: "<:7_:843531840853901352> **Рейтинг недели**",
					value: `\`\`\`ini\n[${weekRating}]\n\`\`\``,
					inline: true,
				},
				{
					name: "<:7_:843531840853901352> **Рейтинг месяца**",
					value: `\`\`\`ini\n[${monthRating}]\n\`\`\``,
					inline: true,
				},
				{
					name: `<:7_:843531840853901352> **Уровень ведущего: ${masterInfo.lvl}**`,
					value: createXpBar(masterInfo),
					inline: false,
				},
			],
		};

		msg.channel.send(msg.author.toString(), {
			embed: masterEmbed,
		});
	},
};

function createXpBar(masterProfile: IEventMasterProfile) {
	const needXp =
		10 * (masterProfile.lvl + 1) * (masterProfile.lvl + 1) +
		10 * (masterProfile.lvl + 1) +
		10;

	// (ТекущийEXP-Уровень1)/((уровень2-Уровень1)/100)
	// const progress =
	// 	(masterProfile.xp - masterProfile.lvl) /
	// 	((masterProfile.lvl + 1 - masterProfile.lvl) / 100);
	// const percentage = Math.round(progress) >= 100 ? 99 : Math.round(progress);
	let string;
	// if (progress >= 0 && progress < 10) {
	// 	string = `<:00:621318969944571905><:00:621318969944571905><:00:621318969944571905><:00:621318969944571905><:00:621318969944571905>`;
	// } else if (progress >= 10 && progress < 20) {
	// 	string = `<:10:621318970313670670><:00:621318969944571905><:00:621318969944571905><:00:621318969944571905><:00:621318969944571905>`;
	// } else if (progress >= 20 && progress < 30) {
	// 	string = `<:20:621318969873399809><:00:621318969944571905><:00:621318969944571905><:00:621318969944571905><:00:621318969944571905>`;
	// } else if (progress >= 30 && progress < 40) {
	// 	string = `<:20:621318969873399809><:30:621318969969868834><:00:621318969944571905><:00:621318969944571905><:00:621318969944571905>`;
	// } else if (progress >= 40 && progress < 50) {
	// 	string = `<:20:621318969873399809><:40:621318970435305475><:00:621318969944571905><:00:621318969944571905><:00:621318969944571905>`;
	// } else if (progress >= 50 && progress < 60) {
	// 	string = `<:20:621318969873399809><:40:621318970435305475><:50:621318970267664407><:00:621318969944571905><:00:621318969944571905>`;
	// } else if (progress >= 60 && progress < 70) {
	// 	string = `<:20:621318969873399809><:40:621318970435305475><:60:621318970191904768><:00:621318969944571905><:00:621318969944571905>`;
	// } else if (progress >= 70 && progress < 80) {
	// 	string = `<:20:621318969873399809><:40:621318970435305475><:60:621318970191904768><:70:621318970351288320><:00:621318969944571905>`;
	// } else if (progress >= 80 && progress < 90) {
	// 	string = `<:20:621318969873399809><:40:621318970435305475><:60:621318970191904768><:80:621318970401751040><:00:621318969944571905>`;
	// } else if (progress >= 90 && progress < 100) {
	// 	string = `<:20:621318969873399809><:40:621318970435305475><:60:621318970191904768><:80:621318970401751040><:90:621318970276052992>`;
	// } else if (progress >= 100) {
	// 	string = `<:20:621318969873399809><:40:621318970435305475><:60:621318970191904768><:80:621318970401751040><:100:643557438452400138>`;
	// }
	string = `Осталось **${Math.ceil(
		(needXp - masterProfile.xp) / 10
	)}** ивентов`;
	// string += ` ${percentage}% **(осталось ${Math.ceil(
	// 	(needXp - masterProfile.xp) / 10
	// )} ив.)**`;
	return string;
}

function calcWeekRate(masterProfile: IEventMasterProfile, weekRate: number) {
	const masterRate = masterProfile.weekStats.weekEvents.length
		? masterProfile.weekStats.weekEvents
				.map((event) => event.timesDone)
				.reduce((first, second) => {
					return first + second;
				})
		: 0;
	if (masterRate >= weekRate) {
		return `${weekRate}/${weekRate} ✅`;
	} else {
		return `${masterRate}/${weekRate} ⏳`;
	}
}

function calcVarietyRate(
	masterProfile: IEventMasterProfile,
	weekVarietyRate: number
) {
	const masterVarietyRate = masterProfile.weekStats.weekEvents.length
		? masterProfile.weekStats.weekEvents
				.map((weekEvent) => weekEvent.eventVariety)
				.reduce((first, second) => {
					return first! + second!;
				})
		: 0;
	if (masterVarietyRate! >= weekVarietyRate) {
		return `${masterVarietyRate}/${weekVarietyRate} 😀`;
	} else {
		return `${masterVarietyRate}/${weekVarietyRate} 😦`;
	}
}

function masterSince(sinceMs: number) {
	moment.locale("ru");
	const duration = moment.duration(new Date().getTime() - sinceMs);
	return duration.humanize();
}

export default cmd;
