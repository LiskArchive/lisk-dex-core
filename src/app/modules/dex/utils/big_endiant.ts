// Big Endian Encoding and Decoding
export const int32be = (x: number) => {
    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32BE(x, 0);
  
    return buf.toString('hex');
    
}
  
export const int32beInv = (buffer_x: string) => {
    const buf = Buffer.from(buffer_x, "hex");

    return buf.readInt32BE(0);
}


export const uint32be = (x: number) => {
    const buf = Buffer.allocUnsafe(4);
    buf.writeUInt32BE(x, 0);

    return buf.toString('hex');

}
  
export const uint32beInv = (buffer_x: string): number => {
    const buf = Buffer.from(buffer_x, "hex");

    return buf.readUInt32BE(0);
}