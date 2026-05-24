export function getHostingType(system) {
    if (system.hosting) return system.hosting;
    if (system.isCloud === true) return 'cloud';
    if (system.isCloud === false) return 'on-premise';
    return null;
}

export function isNonCloud(system) {
    const type = getHostingType(system);
    return type === 'on-premise' || type === 'partner-hosted';
}

export function isCloud(system) {
    return getHostingType(system) === 'cloud';
}

export function detectHostingRisk(system, councilToSuccessorMap) {
    if (getHostingType(system) !== 'partner-hosted') return null;
    if (!system.hostingPartner) return null;

    const partnerSuccessors = councilToSuccessorMap.get(system.hostingPartner);

    if (!partnerSuccessors || partnerSuccessors.length === 0) {
        return {
            risk: 'governance',
            detail: `Hosted by ${system.hostingPartner} (external to this merger). Partnership agreement will need novation to successor authority.`
        };
    }

    const sourceCouncil = system._sourceCouncil;
    const sourceSuccessors = councilToSuccessorMap.get(sourceCouncil) || [];
    const sameSuccessor = sourceSuccessors.some(s => partnerSuccessors.includes(s));

    if (sameSuccessor) {
        return { risk: 'none', detail: `Hosted by ${system.hostingPartner} — both map to the same successor.` };
    }

    return {
        risk: 'continuity',
        detail: `Hosted by ${system.hostingPartner} which maps to a different successor. Day 1 hosting continuity agreement required.`
    };
}
