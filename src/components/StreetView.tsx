'use client';

/**
 * The panorama you are dropped into.
 *
 * An iframe on the Maps Embed API rather than the Street View JavaScript SDK:
 * the embed is free and unmetered where the SDK bills per panorama load, and
 * for this round all that is needed is a picture you can look around in.
 *
 * Google's own attribution and the "View on Google Maps" control are part of
 * the embed and are left alone — covering them would break the terms the free
 * tier is offered under, and the round survives somebody who insists on
 * cheating that way.
 */

import { useState } from 'react';
import { streetViewUrl, type PanoView } from '@/game/maps';

export default function StreetView({ view, label }: { view: PanoView; label?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="street-view street-view-failed">
        <p className="muted">This panorama would not load — guess from the map, or skip on.</p>
      </div>
    );
  }

  return (
    <div className="street-view">
      <iframe
        key={`${view.lat},${view.lng},${view.heading}`}
        title={label ?? 'Street view'}
        src={streetViewUrl(view)}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        onError={() => setFailed(true)}
      />
      {/*
        The embed prints the street address in its top-left corner, which hands
        over the answer before anyone has looked at the picture, and the Embed
        API has no parameter to turn it off. So it is covered.

        Only that card. Google's attribution — the wordmark along the bottom and
        the Terms / Report a problem links — is left completely alone, because
        obscuring *that* is what the Maps terms actually forbid. The cover also
        swallows clicks, which is deliberate: the card contains a "View on
        Google Maps" link that would open the answer in a new tab.
      */}
      <div className="street-view-mask" aria-hidden="true" />
    </div>
  );
}
