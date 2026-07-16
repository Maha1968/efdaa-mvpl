type TokenFindsHeroProps = {
  photos: string[];
  senderFirstName: string;
};

export function TokenFindsHero({
  photos,
  senderFirstName,
}: TokenFindsHeroProps) {
  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-stone-100">
        <p className="px-6 text-center text-sm text-zinc-600">
          {senderFirstName}&apos;s finds
        </p>
      </div>
    );
  }

  if (photos.length === 1) {
    return (
      <div className="overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[0]}
          alt={`${senderFirstName}'s find`}
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[0]}
          alt={`${senderFirstName}'s find`}
          className="aspect-[4/3] w-full object-cover"
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {photos.slice(1, 5).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${url}-${i}`}
            src={url}
            alt={`${senderFirstName}'s find ${i + 2}`}
            className="aspect-square w-full rounded-xl object-cover"
          />
        ))}
      </div>
    </div>
  );
}
