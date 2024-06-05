import { Schema, model } from "mongoose";

const _starsFromE = new Schema({
	uid: String,
	eventsData: [Object],
	eventName: String,
	totalStars: Number,
});

export interface IStarsFromE {
	uid: string;
	eventsData: IEventData[];
	eventName?: string;
	totalStars?: number;
}

interface IEventData {
	eventName: string;
	totalStars: number;
}

export const starsFromEventModel = model<IStarsFromE>(
	"starsFromEvents",
	_starsFromE
);
