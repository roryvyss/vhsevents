import { GuildMember, MessageEmbed, TextChannel } from "discord.js";
import { masterModel } from "../db/models/masterProfile";
import { config, FUNCS, IEvent } from "../settings/utils";

const event: IEvent<"guildMemberUpdate"> = {
	name: "guildMemberUpdate",
	run: async (oldMember, newMember) => {
		if (oldMember.partial) return console.log("partial");
		if ((oldMember.guild.id || newMember.guild.id) != config.IDS.GUILDID)
			return;

		const logChannel = FUNCS.getLogChannel(newMember.guild);

		if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

		const lessRolesMember =
			oldMember.roles.cache.size > newMember.roles.cache.size
				? oldMember
				: newMember;
		const moreRolesMember =
			oldMember.roles.cache.size < newMember.roles.cache.size
				? oldMember
				: newMember;

		const updatedRole = lessRolesMember.roles.cache
			.array()
			.filter((r) => !moreRolesMember.roles.cache.array().includes(r));

		const embed = new MessageEmbed()
			.setColor("PURPLE")
			.setDescription(
				`${newMember.toString()}\nОбновлены роли участника\n> ${updatedRole.map(
					(role) =>
						newMember.roles.cache.has(role.id)
							? `+${role.toString()}`
							: `-${role.toString()}`
				)}`
			)
			.setThumbnail(
				newMember.user.displayAvatarURL({ size: 2048, dynamic: true })
			)
			.setFooter(`ID: ${newMember.id}`)
			.setTimestamp(new Date());

		await eventMasterCheck(oldMember, newMember);
		await logChannel.send(embed);
	},
};

async function eventMasterCheck(
	oldMember: GuildMember,
	newMember: GuildMember
) {
	const ROLES = [
		config.IDS.ROLEIDS.AdminRoleID,
		config.IDS.ROLEIDS.EventCuratorRoleID,
		config.IDS.ROLEIDS.EventMasterRoleID,
		config.IDS.ROLEIDS.JunAdminRoleID,
		config.IDS.ROLEIDS.ModeratorRoleID,
		config.IDS.ROLEIDS.SupportRoleID,
	];

	if (
		!oldMember.roles.cache.some((role) => ROLES.includes(role.id)) &&
		newMember.roles.cache.some((role) => ROLES.includes(role.id))
	) {
		if (await masterModel.findOne({ uid: oldMember.id })) {
			await masterModel.updateOne(
				{ uid: oldMember.id },
				{ removeProfileTime: null }
			);

			FUNCS.logMessage(
				newMember.guild,
				`Для юзера ${newMember.toString()} был создан профиль "ведущих" в базе`
			);

			FUNCS.updEmbedStats(oldMember.guild!);
			return;
		}

		await masterModel.create({
			uid: oldMember.id,
			lvl: 0,
			xp: 0,
			starsEarned: 0,
			completedEvents: [],
			weekRatings: [],
			weekStats: {
				weekEvents: [],
				points: 0,
				minutesOnEvent: 0,
				starsEarned: 0,
				peopleOnEvent: 0,
				messagesOnEvent: 0,
			},
			masterSince: new Date().getTime(),
		});
		FUNCS.logMessage(
			newMember.guild,
			`Для юзера ${newMember.toString()} был создан профиль "ведущих" в базе`
		);

		FUNCS.updEmbedStats(oldMember.guild!);
	} else if (
		!newMember.roles.cache.some((role) => ROLES.includes(role.id)) &&
		oldMember.roles.cache.some((role) => ROLES.includes(role.id))
	) {
		const master = await masterModel.findOne({
			uid: newMember.id,
		});

		await masterModel.deleteOne({
			uid: newMember.id,
		});

		FUNCS.logMessage(
			newMember.guild,
			`Профиль ведущего у ${newMember.toString()} был удален в базе`
		);

		const _ = oldMember.guild?.channels.cache.get(
			config.IDS.CHANNELIDS.adminStatsChannelID
		) as TextChannel;

		const masterMessage = await _.messages.fetch(master!.profileMessage!);
		if (masterMessage) await masterMessage.delete();

		FUNCS.updEmbedStats(oldMember.guild);
	}
}
export default event;
