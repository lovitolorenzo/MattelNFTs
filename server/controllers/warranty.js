import asyncHandler from "express-async-handler";
import Warranty from "../models/Warranty.js";

//@desc Get warranty Profile
//@route /warranty/profile
//@access private
const getWarrantyProfile = asyncHandler(async (req, res) => {
	const warranty = await Warranty.findById(req.warranty._id);

	if (!warranty) {
		res.status(404);
		throw new Error("Warranty doesn't exist");
	}

	let buffer, base64Image;
	if (warranty.image) {
		buffer = Buffer.from(warranty.image);
		base64Image = buffer.toString("base64");
	}

	const { name, email, role, _id, address } = warranty;
	res.json({
		name,
		email,
		role,
		_id,
		image: warranty.image ? base64Image : "",
		address,
	});
});

//@desc Update/Upload warranty image
//@route /profile/image
//@access private
const uploadWarrantyImage = asyncHandler(async (req, res) => {
	req.warranty.image = req.file.buffer;
	await req.warranty.save();

	res.status(201).json({ message: "Image added successfully" });
});

//@desc Update warranty Profile
//@route /warranty/profile/
//@access private
const updateWarrantyProfile = asyncHandler(async (req, res) => {
	const warranty = await Warranty.findById(req.warranty._id);

	const { name, email, role, image, address } = req.body;

	if (warranty) {
		warranty.name = name || warranty.name;
		warranty.email = email || warranty.email;
		warranty.role = role || warranty.role;
		warranty.image = image || warranty.image;
		warranty.address = address || warranty.address;

		await warranty.save();

		res.status(200).json({
			_id: warranty._id,
			name: warranty.name,
			email: warranty.email,
			role: warranty.role,
			address: warranty.address,
		});
	} else {
		res.status(404);
		throw new Error("Warranty not found");
	}
});

export { getWarrantyProfile, updateWarrantyProfile, uploadWarrantyImage };
