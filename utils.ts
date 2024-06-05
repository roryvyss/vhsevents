import Discord from "discord.js";
import functions from "./functions";
import * as Config from "./config.json";

export const config = Config;
export const COMMANDS = new Discord.Collection<string, ICOMMAND>();
export const startingEvent = new Discord.Collection<string, string>();
export const customCooldown = new Discord.Collection<
	string,
	{ id: string; time: number }
>();
export const FUNCS = functions;

type Category = "General" | "Events" | "Dev";
type Permissions =
	| "Dev"
	| "Admin"
	| "JunAdm"
	| "Moderator"
	| "Support"
	| "EventCurator"
	| "EventMaster"
	| "User";

export interface ICOMMAND {
	name: string;
	category: Category;
	desc: string;
	aliases?: string[];
	cooldown: number;
	usage: string;
	permission: Permissions;
	run(
		client: Discord.Client,
		args: string[],
		msg: Discord.Message
	): Promise<unknown>;
}

export interface IEvent<T extends keyof Discord.ClientEvents> {
	name: T;
	run(
		...args: [...Discord.ClientEvents[T], Discord.Client]
	): Promise<unknown>;
}

export const EVENTS: Array<IEvent<keyof Discord.ClientEvents>> = [];
