import { Schema, model, Types } from "mongoose";

const eventSchema = new Schema({
	name: String,
	withSite: Boolean,
	closeData: Object,
	startType: Array,
	eventImage: String,
	starsAmount: Number,
	variety: Number,
	timedRoleID: String,
	cooldown: Object,
});

export interface IEventSchema {
	_id?: Types.ObjectId;
	name: string;
	withSite: boolean;
	closeData: ICloseData;
	startType: number[];
	eventImage: string;
	starsAmount: number;
	variety: number;
	timedRoleID: string;
	cooldown: IEventCooldown;
}

interface IEventCooldown {
	expireTime: number;
	lastInvoker: string;
}

interface ICloseData {
	isClose: boolean;
	firstVoiceName?: string;
	secondVoiceName?: string;
}

export const eventsModel = model<IEventSchema>("events", eventSchema);
