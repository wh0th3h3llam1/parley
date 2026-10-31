import { HallState } from "@/lib/domain";

const yosemitePhotos = [
  { src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80", label: "Mountain view" },
  { src: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=900&q=80", label: "Forest trail" },
  { src: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=900&q=80", label: "Woodland path" },
  { src: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=80", label: "Night in the mountains" }
];
const sanDiegoPhotos = [
  { src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80", label: "Beach" },
  { src: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=900&q=80", label: "Coast" },
  { src: "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=900&q=80", label: "Ocean" },
  { src: "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=900&q=80", label: "Evening outdoors" }
];

export default function TripMedia({ hall }: { hall: HallState }) {
  const photos = hall.scenario === "yosemite" ? yosemitePhotos : sanDiegoPhotos;
  return <section className="trip-media" aria-label="Room photos">
    <div className="media-grid">{photos.map((photo, index) => <figure key={photo.src} className={index === 0 ? "featured" : ""}>
      <img src={photo.src} alt={photo.label} loading={index === 0 ? "eager" : "lazy"} />
      <figcaption>{photo.label}</figcaption>
    </figure>)}</div>
    <p>Sample trip photos · Unsplash</p>
  </section>;
}
