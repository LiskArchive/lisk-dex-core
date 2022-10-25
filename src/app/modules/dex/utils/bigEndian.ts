// Big Endian Encoding and Decoding
export const int32be = (x: number) => {
	const buf = Buffer.allocUnsafe(4);
	buf.writeInt32BE(x, 0);

	return buf.toString('hex');
};

export const int32beInv = (bufferX: string) => {
	const buf = Buffer.from(bufferX, 'hex');

	return buf.readInt32BE(0);
};

export const uint32be = (x: number) => {
	const buf = Buffer.allocUnsafe(4);
	buf.writeUInt32BE(x, 0);

	return buf.toString('hex');
};

export const uint32beInv = (bufferX: string): number => {
	const buf = Buffer.from(bufferX, 'hex');
	return buf.readUInt32BE(0);
};
