

export type DBusVariantDict = Array<[key: string, value: DBusValue]>;

type DBusValue =
    // These are the types we care about here in practice. There are lots of other types, documented at:
    // https://dbus.freedesktop.org/doc/dbus-specification.html#type-system
    | [[{ type: 's' }], [string]]
    | [[{ type: 'a', child: [{ type: '{', child: [{ type: 's' }, { type: 'v' }]}] }], [DBusVariantDict]];

type ParsedDict = { [key: string]: string | ParsedDict };

export function parseDBusValue(dbusValue: DBusValue) {
    const [type] = dbusValue[0];
    const [rawValue] = dbusValue[1];

    if (type.type === 's') {
        // It's a raw string, great.
        return rawValue as string;
    } else if (
        type.type === 'a' &&
        type.child[0].type === '{' &&
        type.child[0].child[0].type === 's' &&
        type.child[0].child[1].type === 'v'
    ) {
        // Variant dict - parse into an object
        return parseDBusVariantDict(rawValue as DBusVariantDict);
    } else {
        throw new Error(`Unrecognized D-Bus type: ${JSON.stringify(type)}`);
    }
}

export function parseDBusVariantDict(dbusDict: DBusVariantDict) {
    return dbusDict.reduce((dict, [key, value]) => {
        dict[key] = parseDBusValue(value);
        return dict;
    }, {} as ParsedDict);
}