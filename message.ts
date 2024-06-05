import { Message } from "discord.js";
import moment from "moment";
import { activeEvents } from "../db/models/activeEvents";
import { afkModel } from "../db/models/afkModel";
import { IEvent, config, COMMANDS, FUNCS, ICOMMAND } from "../settings/utils";

const event: IEvent<"message"> = {
	name: "message",
	run: async (msg, client) => {
		if (msg.author.bot) return;
		if (!msg.guild) return;

		if (msg.guild.id != config.IDS.GUILDID) return;

		checkEventChannel(msg);

		if (!msg.content.startsWith(config.PREFIX)) {
			checkAfk(msg);
			return;
		}

		const [cmd, ...args] = msg.content
			.slice(config.PREFIX.length)
			.split(/ +/g);

		let command = COMMANDS.get(cmd);
		if (!command) {
			command = COMMANDS.filter(
				(command) => command.aliases != undefined
			).find((command) => command.aliases!.includes(cmd));
			if (command) {
				if (checkChannel(msg, command)) return;
				if (FUNCS.checkPerms(command.permission, msg)) {
					command.run(client, args, msg);
				}
			}
		} else {
			if (checkChannel(msg, command)) return;
			if (FUNCS.checkPerms(command.permission, msg)) {
				command.run(client, args, msg);
			}
		}
	},
};

function checkChannel(msg: Message, command: ICOMMAND) {
	switch (command.name) {
		case "ивент":
			if (msg.channel.id != config.IDS.CHANNELIDS.BotsChannelID) {
				msg.reply(
					`Вы не можете использовать команды в этом чате. Перейдите в: <#${config.IDS.CHANNELIDS.BotsChannelID}>`
				);
				return true;
			}
			break;
		default:
			break;
	}
}

async function checkAfk(msg: Message) {
	try {
		const isAfk = await afkModel.findOne({
			userId: msg.author.id,
		});
		if (isAfk) {
			await afkModel.deleteOne({
				userId: msg.author.id,
			});
			return msg
				.reply(`Я сняла ваш статус **AFK**`)
				.then((m) => m.delete({ timeout: 10000 }));
		}
	} catch (err) {
		console.log(`Произошла ошибка при проверке на "AFK"`);
		return;
	}

	try {
		const mentionedMember = msg.mentions.members?.first();
		const mentionedMemberAFK = await afkModel.findOne({
			userId: mentionedMember?.id,
		});

		if (!mentionedMemberAFK) return;

		const afkTime = getAfkTime(
			new Date().getTime() - mentionedMemberAFK.time
		);

		msg.reply(
			`Участник ${mentionedMember?.user.tag} сейчас **AFK** \`[${afkTime}]\`.\n**Сообщение**: ${mentionedMemberAFK.message}`
		).then((m) => m.delete({ timeout: 10000 }));
	} catch (err) {
		console.log(`Произошла ошибка при проверке на "AFK"`);
	}
}

async function checkEventChannel(msg: Message) {
	const activeEvent = await activeEvents.findOne({
		"rooms.text.main": msg.channel.id,
	});

	if (!activeEvent) return;

	const idx = activeEvent.membersData.findIndex(
		(item) => item.uid === msg.author.id
	);
	if (idx === Number("-1")) return;
	activeEvent.membersData[idx].messages += 1;

	await activeEvents.updateOne(
		{
			_id: activeEvent._id,
		},
		activeEvent
	);
}

function getAfkTime(time: number) {
	const duration = moment.duration(time);
	const seconds = duration.seconds();
	const minutes = duration.minutes();
	const hours = duration.hours();
	const sMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
	const sSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
	if (hours != 0) {
		return `${hours}ч ${sMinutes}м`;
	} else if (minutes != 0) {
		return `${minutes}м ${sSeconds}с`;
	} else {
		return `${seconds}с`;
	}
}

export default event;
