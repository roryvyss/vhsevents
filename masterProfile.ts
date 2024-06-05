import { Schema, model, Types } from "mongoose";

const masterProfiles = new Schema({
	uid: String,
	completedEvents: [Object],
	masterSince: Number,
	lvl: Number,
	xp: Number,
	starsEarned: Number,
	weekStats: Object,
	weekRatings: [Object],
	profileMessage: String,
	removeProfileTime: Number,
});

export interface IEventMasterProfile {
	_id?: Types.ObjectId;
	uid: string;
	completedEvents: ICompletedEvent[];
	masterSince: number;
	lvl: number;
	xp: number;
	starsEarned: number;
	weekStats: IWeekStats;
	weekRatings: IWeekRate[];
	profileMessage?: string;
	removeProfileTime?: number | null;
}

interface ICompletedEvent {
	name: string;
	timesDone: number;
	eventVariety?: number;
}

export interface IWeekRateEvents {
	name: string;
	timesDone: number;
}

interface IWeekRate {
	weekEvents: IWeekRateEvents[];
	variety: number;
	celery: number;
	rating: number;
	starsEarned: number;
	minutesOnEvent: number;
	peopleOnEvent: number;
	messagesOnEvent: number;
}

interface IWeekStats {
	points: number;
	weekEvents: ICompletedEvent[];
	minutesOnEvent: number;
	starsEarned: number;
	peopleOnEvent: number;
	messagesOnEvent: number;
}

export const masterModel = model<IEventMasterProfile>(
	"masterProfiles",
	masterProfiles
);
