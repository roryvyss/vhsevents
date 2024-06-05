import { GuildManager, GuildMember, Message, MessageEmbed } from "discord.js";
import { eventWarnModel } from "../../db/models/eventWarnsModel";
import { unixesModel } from "../../db/models/unixesModel";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "ивент-пред",
	category: "Events",
	desc: "Команда для выдачи предупреждения юзеру на **7** дней",
	cooldown: 2,
	usage: config.PREFIX + "ивент-пред @mention",
	permission: "EventCurator",
	run: async (client, args, msg) => {
		if (
			msg.member?.roles.cache.some((r) =>
				[config.IDS.ROLEIDS.SupportRoleID].includes(r.id)
			)
		)
			return;

		const member = msg.mentions.members?.first();

		if (!member) {
			return msg
				.reply(
					`Вы забыли упомянуть пользователя, которому хотите выдать предупреждение`
				)
				.then((m) => m.delete({ timeout: 5000 }));
		}

		const alreadyExist = await eventWarnModel.findOne({
			uid: member.id,
		});

		if (alreadyExist && alreadyExist.warnExpires > new Date().getTime()) {
			member.roles.add(config.IDS.ROLEIDS.EventBanRoleID);
			member.roles.remove(config.IDS.ROLEIDS.EventWarnRoleID);
			msg.reply(`Участник ${member.toString()} получил Ивент Бан.`);
			await eventWarnModel.deleteOne({
				uid: member.id,
			});

			const _ = await unixesModel.findOne({
				userId: member.id,
				Type: 2,
				role: config.IDS.ROLEIDS.EventBanRoleID,
			});

			await unixesModel.deleteOne({
				userId: member.id,
				Type: 2,
				role: config.IDS.ROLEIDS.EventWarnRoleID,
			});

			if (_) {
				await unixesModel.updateOne({
					userId: member.id,
					Type: 2,
					role: config.IDS.ROLEIDS.EventBanRoleID,
					time: new Date().getTime() / 1000 + 86400 * 7,
				});
			} else {
				await unixesModel.create({
					userId: member.id,
					Type: 2,
					role: config.IDS.ROLEIDS.EventBanRoleID,
					time: new Date().getTime() / 1000 + 86400 * 7,
				});
			}
		} else if (alreadyExist) {
			await eventWarnModel.updateOne(
				{
					uid: member.id,
				},
				{
					warnExpires: new Date().getTime() + 604800000,
				}
			);
			warnMessage(msg, member);
		} else {
			member.roles.add(config.IDS.ROLEIDS.EventWarnRoleID);
			const _ = await unixesModel.findOne({
				userId: member.id,
				Type: 2,
				role: config.IDS.ROLEIDS.EventWarnRoleID,
			});

			if (_) {
				await unixesModel.updateOne({
					userId: member.id,
					Type: 2,
					role: config.IDS.ROLEIDS.EventWarnRoleID,
					time: new Date().getTime() / 1000 + 86400 * 7,
				});
			} else {
				await unixesModel.create({
					userId: member.id,
					Type: 2,
					role: config.IDS.ROLEIDS.EventWarnRoleID,
					time: new Date().getTime() / 1000 + 86400 * 7,
				});
			}

			await eventWarnModel.create({
				uid: member.id,
				warnExpires: new Date().getTime() + 604800000,
			});
			warnMessage(msg, member);
		}
	},
};

function warnMessage(message: Message, member: GuildMember) {
	const embed = new MessageEmbed()
		.setColor("RANDOM")
		.setDescription(
			`Вам было выдано **предупреждение**.\nЕсли в течении **7** дней вы получите еще одно, то вам будет выдана роль\n**<@&${config.IDS.ROLEIDS.EventBanRoleID}>**`
		);
	message.channel.send(member.toString(), embed);
}

export default cmd;
