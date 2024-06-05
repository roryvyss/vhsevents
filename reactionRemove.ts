import { MessageEmbed, MessageReaction, PartialUser, User } from "discord.js";
import { activeEvents } from "../db/models/activeEvents";
import { config, FUNCS, IEvent } from "../settings/utils";

const event: IEvent<"messageReactionRemove"> = {
	name: "messageReactionRemove",
	run: async (reaction, user, client) => {
		if (reaction.partial) {
			try {
				await reaction.fetch();
			} catch (err) {
				return;
			}
		}

		if (user.partial) {
			try {
				await user.fetch();
			} catch (err) {
				return;
			}
		}

		if (user.bot) return;
		if (reaction.message.guild?.id != config.IDS.GUILDID) return;

		switch (reaction.message.channel.id) {
			case config.IDS.CHANNELIDS.eventAnnounceChannelID:
				switch (reaction.emoji.name) {
					case "🟢":
						leaveEventQueue(reaction, user);
						break;
				}
		}
	},
};

async function leaveEventQueue(
	reaction: MessageReaction,
	user: User | PartialUser
) {
	const message = reaction.message;
	const member = await message.guild?.members.fetch(user.id);

	if (member?.roles.cache.has(config.IDS.ROLEIDS.EventBanRoleID))
		return reaction.users.remove(user.id);

	const activeEvent = await activeEvents.findOne({
		"delayedLaunch.lobby.messageId": message.id,
	});

	if (!activeEvent) return reaction.users.remove(user.id);

	const filteredPlayers = activeEvent.delayedLaunch!.lobby!.players!.filter(
		(player) => player != member?.id
	);

	activeEvent.delayedLaunch!.lobby!.players = filteredPlayers;
	const totalPlayers = activeEvent.delayedLaunch!.lobby?.players.length;

	let embed = message.embeds[0];
	let players = "";
	let pos = 1;

	if (totalPlayers) {
		for (const player of activeEvent.delayedLaunch?.lobby?.players!) {
			try {
				const member = await message.guild?.members.fetch(player);
				players += `\`#${pos}\` - ${member?.toString()} (${
					member?.user.username
				})\n`;
			} catch (err) {
				players += `👻\n`;
			}
			pos += 1;
		}
	}
	const thirdStartDate = new Date(activeEvent.delayedLaunch!.startIn!);
	const locale = thirdStartDate.toLocaleString("ru", {
		timeZone: "Europe/Moscow",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const master = await message.guild?.members.fetch(activeEvent.master);

	const thirdStart = {
		title: `${activeEvent.event.name} от ${master!.user.username}`,
		color: 15723756,
		description:
			`Дорогие пользователи нашего сервера. Открылся набор на ивент **${activeEvent.event.name}**` +
			`\n\nНажмите на 🟢 чтобы записаться на ивент` +
			`\n\`\`\`fix\nНужно игроков для старта: ${activeEvent.slots}\`\`\`` +
			`\n${players}` +
			`\n<:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166>` +
			`\n<:arrowL:757210873860194364>Победители получают:` +
			`\n**${
				activeEvent.event.starsAmount
			} звёзд** ${await FUNCS.getCurrencyLogo(reaction.message.guild!)}${
				activeEvent.event.timedRoleID
					? ` и роль <@&${activeEvent.event.timedRoleID}> на **7 дней**`
					: ""
			}` +
			`\n<:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166><:line:797862551550427166>` +
			`\n:warning: Если вы запишитесь на ивент и не придете, то вы получите роль <@&${config.IDS.ROLEIDS.EventBanRoleID}> на 3 дня.\n`,
		author: {
			name: `Набор игроков ${totalPlayers}/${activeEvent.slots}`,
		},
		image: {
			url: `${activeEvent.event.eventImage}`,
		},
		footer: {
			text: `Сбор будет активен до [${locale} МСК]`,
		},
		fields: [
			{
				name: "🔊 Подключится",
				value: `**${totalPlayers}/${activeEvent.slots}** - [набор игроков]`,
				inline: true,
			},
			{
				name: "🔕 Отключить пинги?",
				value: "[Нажми на реакцию 🔰](https://discordapp.com/channels/508698707861045248/605184792325128213/690097328937238544)",
				inline: true,
			},
		],
	};

	embed = new MessageEmbed(thirdStart);

	await activeEvents.updateOne(
		{
			_id: activeEvent._id,
		},
		activeEvent
	);

	message.edit(`<@&${config.IDS.ROLEIDS.EventRoleID}>`, embed);
}

export default event;
