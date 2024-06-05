import { Schema, model } from "mongoose";

const _eventWarnsSchema = new Schema({
	uid: String,
	warnExpires: Number,
});

export interface IEventWarnsSchema {
	uid: String;
	warnExpires: number;
}

export const eventWarnModel = model<IEventWarnsSchema>(
	"eventWarns",
	_eventWarnsSchema
);
