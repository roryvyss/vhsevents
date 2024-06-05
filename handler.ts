import Discord from "discord.js";
import glob from "glob";
import { promisify } from "util";
import { ICOMMAND, IEvent, EVENTS, COMMANDS } from "../settings/utils";

const globAsync = promisify(glob);

export default async () => {
	const cmdFiles = await globAsync(`${__dirname}/../Commands/**/*.{js,ts}`);
	const eventFiles = await globAsync(`${__dirname}/../Events/*.{js,ts}`);

	let cmdCount = 0,
		eventCount = 0;

	for (const cmdFile of cmdFiles) {
		const command = (await import(cmdFile)).default as ICOMMAND;

		if (command.name) {
			COMMANDS.set(command.name, command);
			cmdCount++;
		}
	}
	for (const eventFile of eventFiles) {
		const event = (await import(eventFile)).default as IEvent<
			keyof Discord.ClientEvents
		>;

		if (event.name) {
			EVENTS.push({ ...event });
			eventCount++;
		}
	}

	console.log(
		`[ ${cmdCount} - commands was successful loaded. ]\n[ ${eventCount} - events was successful loaded. ]`
	);
};
