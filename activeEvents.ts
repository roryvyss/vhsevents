import { MessageEmbed } from "discord.js";
import { Schema, model, Types } from "mongoose";
import { IEventSchema } from "../models/eventsModel";

const eventSchema = new Schema({
	event: Object,
	site: String,
	startType: Number,
	slots: Number,
	master: String,
	eventStarted: Number,
	announceMsgId: String,
	points: Array,
	membersData: Array,
	repeats: {
		type: Number,
		default: 0,
	},
	rooms: Object,
	delayedLaunch: Object,
	startedByTimedMaster: Object,
});

export interface IActiveEventSchema {
	_id?: Types.ObjectId;
	event: IEventSchema;
	site?: string;
	startType: number;
	slots: number;
	master: string;
	eventStarted: number;
	announceMsgId: string;
	repeats: number;
	membersData: IMembersData[];
	points?: IPoints[];
	rooms?: IRooms;
	delayedLaunch?: IDelayedLaunch;
	startedByTimedMaster?: IStartedByTimedMaster;
}

interface IStartedByTimedMaster {
	announceEmbed: Object;
}

interface IDelayedLaunch {
	stage: number;
	startIn: number;
	minutes: string;
	lobby?: ILobby;
}

interface IRooms {
	text?: {
		main: string;
		addional?: string[];
	};
	voice?: {
		main: string;
		addional?: string[];
	};
}
interface ILobby {
	players: string[];
	messageId: string;
}

interface IPoints {
	uid: string;
	point: number;
}

export interface IMembersData {
	uid: string;
	messages: number;
	totalMins: number;
	joinDate: number | null;
}

export const activeEvents = model<IActiveEventSchema>(
	"activeevents",
	eventSchema
);
