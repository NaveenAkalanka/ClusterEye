export function ipToLong(ip) {
    if (!ip) return 0;
    const parts = ip.split('.');
    if (parts.length !== 4) return 0;
    return ((parseInt(parts[0]) << 24) | (parseInt(parts[1]) << 16) | (parseInt(parts[2]) << 8) | parseInt(parts[3])) >>> 0;
}

export function longToIp(long) {
    return [
        (long >>> 24) & 0xFF,
        (long >>> 16) & 0xFF,
        (long >>> 8) & 0xFF,
        long & 0xFF
    ].join('.');
}

export function isIpInSubnet(ip, network, mask) {
    const ipLong = ipToLong(ip);
    const netLong = ipToLong(network);
    const maskLong = ipToLong(mask);

    if (ipLong === 0 || netLong === 0 || maskLong === 0) return false;

    return (ipLong & maskLong) === (netLong & maskLong);
}

export function calculateNetworkAddress(ip, mask) {
    const ipLong = ipToLong(ip);
    const maskLong = ipToLong(mask);
    return longToIp(ipLong & maskLong);
}

export function isValidSubnetMask(mask) {
    if (!mask) return false;
    // Check format regex first to ensure it looks like an IP
    const ipRegex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
    if (!ipRegex.test(mask)) return false;

    const m = ipToLong(mask);
    // In a valid subnet mask, the binary form is a sequence of 1s followed by 0s.
    // This means (~m + 1) & (~m) should be 0.
    // However, JS bitwise is signed.
    // ~m corresponds to the inverse. If m = 11110000, ~m = 00001111. (~m + 1) = 00010000.
    // ANDing them gives 0.
    // If m = 11101000 (invalid), ~m = 00010111. ~m+1 = 00011000. AND = 00010000 != 0.
    const inv = ~m;
    return ((inv + 1) & inv) === 0;
}
