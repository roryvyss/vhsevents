import { Message, MessageReaction, User } from "discord.js";
import { eventsModel, IEventSchema } from "../../db/models/eventsModel";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивсоздать",
	category: "Events",
	desc: "Команда для создания ивента",
	cooldown: 2,
	usage: config.PREFIX + "ивсоздать",
	permission: "EventCurator",
	run: async (client, args, msg) => {
		const eventData = {} as IEventSchema;

		eventData.startType = [];
		eventData.closeData = {
			isClose: false,
		};
		const messages: string[] = [];

		await msg.delete();

		try {
			await collectEventData(
				await msg.channel.send(`1 × Введите название ивента`),
				eventData,
				1,
				messages,
				msg.author
			);

			await collectEventData(
				await msg.channel.send(`2 × Ивент проводится через сайт?`),
				eventData,
				2,
				messages,
				msg.author
			);

			await collectEventData(
				await msg.channel.send(
					`3 × Нужно перечислить варианты запуска без пробелов, через запятую. Пример: \`1,2,3\`` +
						`\n\`1\` - Ивент можно будет запустить сразу` +
						`\n\`2\` - Ивент можно будет запустить позже` +
						`\n\`3\` - Ивент запустится только после набора игроков`
				),
				eventData,
				3,
				messages,
				msg.author
			);

			await collectEventData(
				await msg.channel.send(
					`4 × Ссылка на картинку ивента, нужна прямая ссылка которая кончается на \`.png .jpeg .jpg .gif \``
				),
				eventData,
				4,
				messages,
				msg.author
			);

			await collectEventData(
				await msg.channel.send(
					`5 × Сколько звёзд получит победитель ивента?`
				),
				eventData,
				5,
				messages,
				msg.author
			);

			await collectEventData(
				await msg.channel.send(
					`6 × Разнообразие? Указывать от **1** до **5**`
				),
				eventData,
				6,
				messages,
				msg.author
			);

			await collectEventData(
				await msg.channel.send(`7 × Ивент будет клозом?`),
				eventData,
				7,
				messages,
				msg.author
			);

			await collectEventData(
				await msg.channel.send(
					`8 × Укажите **ID** временной роли, которая будет выдаваться на **7** дней за победу в ивенте. Если таковой нет, напишите \`нет\``
				),
				eventData,
				8,
				messages,
				msg.author
			);

			const sentMsg = await msg.channel.send(
				`Ивент **${
					eventData.name
				}** будет создан со следующими параметрами:\n${Object.keys(
					eventData
				)
					.map(
						(key) =>
							`**${key}** - ${
								typeof eventData[key] === "object"
									? Object.keys(eventData[key]).map(
											(k) => eventData[key][k]
									  )
									: key === "timedRoleId"
									? `<@&${eventData[key]}>`
									: eventData[key]
							}`
					)
					.join("\n")}`
			);

			messages.push(sentMsg.id);

			const allowedReactions = [
				"633712359772389386",
				"633712357129977876",
			];

			for (const emote of allowedReactions) {
				await sentMsg.react(emote);
			}

			const filter = (reaction: MessageReaction, user: User) => {
				return (
					allowedReactions.includes(reaction.emoji.id!) &&
					user.id === msg.author.id
				);
			};

			sentMsg
				.awaitReactions(filter, { max: 1, time: 600000 })
				.then(async (collected) => {
					const reaction = collected.first();

					switch (reaction?.emoji.id) {
						case "633712359772389386":
							await eventsModel.create(eventData);
							if (msg.channel.type === "text") {
								msg.channel.bulkDelete(messages);
							}
							msg.reply(`Ивент успешно создан!`).then((m) =>
								m.delete({ timeout: 5000 })
							);
							break;
						case "633712357129977876":
							if (msg.channel.type === "text") {
								msg.channel.bulkDelete(messages);
							}
							msg.reply(`Создание ивента отменено`).then((m) =>
								m.delete({ timeout: 5000 })
							);
							break;
					}
				});
		} catch (err) {}
	},
};

async function collectEventData(
	msg: Message,
	eventObj: IEventSchema,
	stage: number,
	messages: string[],
	author: User
) {
	return new Promise(async (resolve, reject) => {
		const yesID = "633712359772389386";
		const noID = "633712357129977876";
		const filter = (message: Message) => {
			return message.author.id === author.id;
		};
		let answer: Message | undefined;
		const reactionStage = [2, 7];

		if (!reactionStage.includes(stage)) {
			const collection = await msg.channel.awaitMessages(filter, {
				max: 1,
				time: 600000,
			});
			answer = collection.first();
		}

		if (!answer && !reactionStage.includes(stage)) {
			await msg.delete();
			return reject(
				msg.channel
					.send(
						`${author.toString()}, вы не успели ответить на вопрос, запустите создание ивента снова`
					)
					.then((m) => m.delete({ timeout: 15000 }))
			);
		}

		!reactionStage.includes(stage)
			? messages.push(msg.id, answer!.id)
			: messages.push(msg.id);

		let reaction;

		if (reactionStage.includes(stage)) {
			const allowedReactions = [yesID, noID];
			const reactionFilter = (reaction: MessageReaction, user: User) => {
				return (
					allowedReactions.includes(reaction.emoji.id!) &&
					user.id === author.id
				);
			};

			for (const emote of allowedReactions) {
				await msg.react(emote);
			}

			const coll = await msg.awaitReactions(reactionFilter, {
				max: 1,
				time: 600000,
			});
			reaction = coll.first();
		}

		switch (stage) {
			case 1:
				eventObj.name = answer!.content;
				break;
			case 2:
				switch (reaction?.emoji.id) {
					case yesID:
						eventObj.withSite = true;
						break;
					case noID:
						eventObj.withSite = false;
						break;
				}
				break;
			case 3:
				const allowedTypes = [1, 2, 3];
				const proviedTypes = answer?.content.split(",");

				proviedTypes?.map((type) => {
					if (allowedTypes.includes(Number(type))) {
						eventObj.startType?.push(Number(type));
					}
				});

				if (!eventObj.startType?.length) {
					if (msg.channel.type === "text") {
						msg.channel.bulkDelete(messages);
					}
					return reject(
						msg.channel
							.send(
								`${author.toString()}, вы указали неверные типы/тип`
							)
							.then((m) => m.delete({ timeout: 5000 }))
					);
				}
				break;
			case 4:
				const regEx =
					/(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|gif|png|jpeg)/gi;
				const image = answer?.content;

				if (!image?.match(regEx)) {
					if (msg.channel.type === "text") {
						msg.channel.bulkDelete(messages);
					}
					return reject(
						msg.channel
							.send(
								`${author.toString()}, вы указали неверное изображение`
							)
							.then((m) => m.delete({ timeout: 5000 }))
					);
				}

				eventObj.eventImage = image;
				break;
			case 5:
				const amount = Number(answer?.content);

				if (isNaN(amount) || amount < 0) {
					if (msg.channel.type === "text") {
						msg.channel.bulkDelete(messages);
					}
					return msg.channel
						.send(`${author.toString()}, вы указали неверное число`)
						.then((m) => m.delete({ timeout: 5000 }));
				}

				eventObj.starsAmount = amount;
				break;
			case 6:
				const variety = Number(answer?.content);

				if (isNaN(variety)) {
					if (msg.channel.type === "text") {
						msg.channel.bulkDelete(messages);
					}
					return msg.channel
						.send(`${author.toString()}, вы указали неверное число`)
						.then((m) => m.delete({ timeout: 5000 }));
				}

				if (![1, 2, 3, 4, 5].includes(variety)) {
					if (msg.channel.type === "text") {
						msg.channel.bulkDelete(messages);
					}
					return msg.channel
						.send(
							`${author.toString()}, вы указали число которое меньше **1** или больше **5**`
						)
						.then((m) => m.delete({ timeout: 5000 }));
				}

				eventObj.variety = variety;
				break;
			case 7:
				switch (reaction?.emoji.id) {
					case yesID:
						eventObj.closeData.isClose = true;
						await collectEventData(
							await msg.channel.send(
								`7.1 × Вам нужно указать название для первой и второй голосовой комнаты которые будут создаваться при запуске клоза.\nПример: Dire;Radiant`
							),
							eventObj,
							7.1,
							messages,
							author
						);
						break;
					case noID:
						break;
				}
				break;
			case 7.1:
				const names = answer!.content.split(";");

				if (names.length < 2) {
					if (msg.channel.type === "text") {
						msg.channel.bulkDelete(messages);
					}
					return msg.channel
						.send(
							`${author.toString()}, вы указали название только для одной комнаты`
						)
						.then((m) => m.delete({ timeout: 5000 }));
				}

				eventObj.closeData.firstVoiceName = names[0];
				eventObj.closeData.secondVoiceName = names[1];
				break;
			case 8:
				const roleID = answer?.content;
				const roleMention = answer?.mentions.roles.first();
				const roleExist = roleMention
					? true
					: msg.guild?.roles.cache.has(roleID!)
					? true
					: false;

				if (!roleExist && roleID != "нет") {
					if (msg.channel.type === "text") {
						msg.channel.bulkDelete(messages);
					}
					return msg.channel
						.send(
							`${author.toString()}, вы указали неверный **ID** роли`
						)
						.then((m) => m.delete({ timeout: 5000 }));
				}

				if (roleExist) {
					if (roleMention) {
						eventObj.timedRoleID = roleMention.id
					} else {
						eventObj.timedRoleID = roleID!;
					}
				}
				break;
		}

		resolve(eventObj);
	});
}

export default cmd;
