import { userModel } from "../../db/models/usersModel";
import { ICOMMAND, config } from "../../settings/utils";

const cmd: ICOMMAND = {
	name: "test3",
	category: "Dev",
	desc: "test3",
	cooldown: 2,
	usage: config.PREFIX + "test3",
	permission: "Dev",
	run: async (client, args, msg) => {
		await userModel.findOneAndUpdate(
			{
				userId: msg.author.id,
			},
			{
				$inc: {
					Currency: 50,
				},
			}
		);
	},
};

export default cmd;
