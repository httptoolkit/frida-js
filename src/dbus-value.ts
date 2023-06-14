import * as Long from 'long';

export type DBusVariantDict = Array<[key: string, value: DBusValue]>;

type DBusValue =
    // These are the types we care about here in practice. There are lots of other types, documented at:
    // https://dbus.freedesktop.org/doc/dbus-specification.html#type-system
    | [[{ type: 's' }], [string]]
    | [[{ type: 'a', child: [{ type: '{', child: [{ type: 's' }, { type: 'v' }]}] }], [DBusVariantDict]]
    | [[{ type: 'x' }], [number, number | undefined]] // Int64
    | [[{ type: 't' }], [number, number | undefined]]; // Uint64

export type NestedStringDict = { [key: string]: string | NestedStringDict };

export function parseDBusValue(dbusValue: DBusValue): string | NestedStringDict {
    const [type] = dbusValue[0];
    const [...rawValue] = dbusValue[1];

    if (type.type === 's') {
        // It's a raw string, great.
        return rawValue[0] as string;
    } else if (
        type.type === 'a' &&
        type.child[0].type === '{' &&
        type.child[0].child[0].type === 's' &&
        type.child[0].child[1].type === 'v'
    ) {
        // Variant dict - parse into an object
        return parseDBusVariantDict(rawValue[0] as DBusVariantDict);
    } else if (type.type === 'x' || type.type === 't') {
        const signed = type.type === 'x';
        const [low, high] = rawValue as [number, number | undefined];
        return Long.fromBits(low, high ?? 0, signed).toString(); // We map all metadata to string
    } else {
        throw new Error(`Unrecognized D-Bus type: ${JSON.stringify(type)}`);
    }
}

export function parseDBusVariantDict(dbusDict: DBusVariantDict) {
    return dbusDict.reduce((dict, [key, value]) => {
        dict[key] = parseDBusValue(value);
        return dict;
    }, {} as NestedStringDict);
}