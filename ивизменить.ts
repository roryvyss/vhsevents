import { Message, MessageReaction, User } from "discord.js";
import { eventsModel, IEventSchema } from "../../db/models/eventsModel";
import { masterModel } from "../../db/models/masterProfile";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивизменить",
	category: "Events",
	desc: "Команда для редактирования ивента в базе",
	cooldown: 2,
	usage: config.PREFIX + "ивизменить eventName",
	permission: "EventCurator",
	run: async (client, args, msg) => {
		if (msg.member?.roles.cache.some(r => [config.IDS.ROLEIDS.SupportRoleID, config.IDS.ROLEIDS.ModeratorRoleID].includes(r.id))) return

		const messages: string[] = [];
		messages.push(msg.id);
		const filter = (message: Message) => {
			return message.author.id === msg.author.id;
		};
		const allEvents = await eventsModel.find();
		const listEvents = allEvents
			.map((event, idx) => `\`${idx + 1}\` - ${event.name}`)
			.join("\n");

		const sentMsg = await msg.reply(
			`Выберите ивент по его номеру:\n${listEvents}`
		);

		messages.push(sentMsg.id);

		const collected = await msg.channel.awaitMessages(filter, {
			max: 1,
			time: 600000,
		});
		const collectedMsg = collected.first();
		const answer = collectedMsg?.content;

		if (!collectedMsg) {
			clearMessages(messages, msg);
			return msg
				.reply(`Вы не указали номер ивента, который хотите изменить`)
				.then((m) => m.delete({ timeout: 5000 }));
		}

		messages.push(collectedMsg.id);

		const isExist = allEvents[Number(answer) - 1];

		if (!isExist) {
			clearMessages(messages, msg);
			return msg
				.reply(`Такого ивента не существует`)
				.then((m) => m.delete({ timeout: 5000 }));
		}

		const params = [
			"название",
			"через сайт",
			"варианты запуска",
			"изображение",
			"кол-во звёзд",
			"разнообразие",
			"временная роль",
		];

		await msg.channel
			.send(
				`Укажите параметр которые хотите изменить. Доступные параметры: ${params
					.map((param) => `\`${param}\``)
					.join(", ")}`
			)
			.then((m) => messages.push(m.id));
		msg.channel
			.awaitMessages(filter, { max: 1, time: 600000 })
			.then(async (collected) => {
				const answerMsg = collected.first();
				if (!answerMsg) {
					return msg
						.reply(`Вы не дали ответ вовремя`)
						.then((m) => m.delete({ timeout: 5000 }));
				}

				messages.push(answerMsg.id);
				const param = answerMsg.content;

				if (!params.includes(param)) {
					clearMessages(messages, msg);
					return msg
						.reply(`Вы указали неверный параметр`)
						.then((m) => m.delete({ timeout: 5000 }));
				}

				if (param != "через сайт") {
					await msg.channel
						.send(`Укажите новое значение параметра`)
						.then((m) => messages.push(m.id));
				}
				const eventName = isExist.name;
				const newValue = await editEvent(
					msg,
					msg.author,
					param,
					isExist,
					messages
				);
				if (!newValue) {
					return clearMessages(messages, msg);
				}
				try {
					msg.channel
						.send(
							`Вы успешно изменили параметр **${param}** у ивента **${eventName}** на **${newValue}**`
						)
						.then((m) => m.delete({ timeout: 10000 }));
					await isExist.save();
					clearMessages(messages, msg);
				} catch (err) {
					console.log(err);
				}
			});
	},
};

async function editEvent(
	msg: Message,
	author: User,
	param: string,
	eventData: IEventSchema,
	messages: string[]
) {
	const filter = (message: Message) => {
		return message.author.id === author.id && !message.author.bot;
	};
	let answer;

	if (param != "через сайт") {
		const collection = await msg.channel.awaitMessages(filter, {
			max: 1,
			time: 600000,
		});
		answer = collection.first();
	}

	if (!answer && param != "через сайт") {
		msg.channel
			.send(`${author.toString()}, вы не успели ответить на вопрос`)
			.then((m) => m.delete({ timeout: 15000 }));
		return;
	} else {
		messages.push(answer.id);
	}

	let newValue;

	switch (param) {
		case "название":
			eventData.name = answer.content;
			return eventData.name;
		case "через сайт":
			const allowedReactions = ["✅", "❌"];
			const sentMsg = await msg.channel.send(
				`Ивент проводится через сайт?`
			);

			messages.push(sentMsg.id);
			for (const emote of allowedReactions) {
				await sentMsg.react(emote);
			}

			const filter = (reaction: MessageReaction, user: User) => {
				return (
					allowedReactions.includes(reaction.emoji.name) &&
					user.id === author.id
				);
			};

			const coll = await sentMsg.awaitReactions(filter, {
				max: 1,
				time: 600000,
			});
			const reaction = coll.first();

			switch (reaction?.emoji.name) {
				case "✅":
					eventData.withSite = true;
					break;
				case "❌":
					eventData.withSite = false;
					break;
			}
			return (newValue = eventData.withSite);
		case "варианты запуска":
			const allowedTypes = [1, 2, 3];
			const proviedTypes = answer?.content.split(",");
			eventData.startType = [];

			proviedTypes?.map((type) => {
				if (allowedTypes.includes(Number(type))) {
					eventData.startType?.push(Number(type));
				}
			});

			if (!eventData.startType?.length) {
				msg.channel
					.send(`${author.toString()}, вы указали неверные типы/тип`)
					.then((m) => m.delete({ timeout: 5000 }));
				return;
			}
			return (newValue = eventData.startType.join(", "));
		case "изображение":
			const regEx = /(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|gif|png|jpeg)/gi;
			const image = answer?.content;

			if (!image?.match(regEx)) {
				msg.channel
					.send(
						`${author.toString()}, вы указали неверное изображение`
					)
					.then((m) => m.delete({ timeout: 5000 }));
				return;
			}

			eventData.eventImage = image;
			return (newValue = eventData.eventImage);
		case "кол-во звёзд":
			const amount = Number(answer?.content);

			if (isNaN(amount) || amount < 0) {
				msg.channel
					.send(`${author.toString()}, вы указали неверное число`)
					.then((m) => m.delete({ timeout: 5000 }));
				return;
			}

			eventData.starsAmount = amount;
			return (newValue = eventData.starsAmount);
		case "разнообразие":
			const variety = Number(answer?.content);

			if (isNaN(variety)) {
				msg.channel
					.send(`${author.toString()}, вы указали неверное число`)
					.then((m) => m.delete({ timeout: 5000 }));
				return;
			}

			if (![1, 2, 3, 4, 5].includes(variety)) {
				msg.channel
					.send(
						`${author.toString()}, вы указали число которое меньше **1** или больше **5**`
					)
					.then((m) => m.delete({ timeout: 5000 }));
				return;
			}

			const masters = await masterModel.find();
			for (const master of masters) {
				const weekEvents = master.weekStats.weekEvents;
				if (weekEvents.length) {
					const idx = weekEvents.findIndex(
						(event) => event.name === eventData.name
					);
					if (idx != Number("-1")) {
						master.weekStats.weekEvents[idx].eventVariety = variety;
						await masterModel.updateOne(
							{
								_id: master._id,
							},
							master
						);
					}
				}
			}

			eventData.variety = variety;
			return (newValue = eventData.variety);
		case "временная роль":
			const roleID = answer?.content;
			const roleExist = msg.guild?.roles.cache.has(roleID!)
				? true
				: false;

			if (!roleExist) {
				msg.channel
					.send(
						`${author.toString()}, вы указали неверный **ID** роли`
					)
					.then((m) => m.delete({ timeout: 5000 }));
				return;
			}

			eventData.timedRoleID = roleID;
			return (newValue = eventData.timedRoleID);
	}

	return newValue;
}

function clearMessages(messages: string[], msg: Message) {
	if (msg.channel.type === "text") {
		msg.channel.bulkDelete(messages);
	}
}

export default cmd;
