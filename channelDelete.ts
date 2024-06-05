import { IEvent, config, FUNCS } from "../settings/utils";
import { VoiceChannel, MessageEmbed } from "discord.js";

const event: IEvent<"channelDelete"> = {
	name: "channelDelete",
	run: async (channel) => {
		if (channel.type != "voice") return;

		const vc = channel as VoiceChannel;
		if (vc.guild.id != config.IDS.GUILDID) return;
		const logChannel = FUNCS.getLogChannel(vc.guild);

		const embed = new MessageEmbed()
			.setTitle("Удаление канала")
			.setDescription(
				`Канал \`${
					channel.id
				}\` был удален в категории ${vc.parent?.toString()}`
			)
			.setTimestamp(new Date());

		await logChannel.send(embed);
	},
};

export default event;
