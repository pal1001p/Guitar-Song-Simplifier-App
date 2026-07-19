export function Header() {
  return (
    <>
      <h1 className="font-mono text-5xl font-bold mb-10 text-gray-300">
        Guitar Song Simplifier
      </h1>
      <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
        <li className="mb-2 tracking-[-.01em]">Browse a new song</li>
        <li className="mb-2 tracking-[-.01em]">Upload your song</li>
        <li className="mb-2 tracking-[-.01em]">
          Analyze the song to extract chords and rhythm
        </li>
        <li className="mb-2 tracking-[-.01em]">
          Press record to play and gain feedback in real time
        </li>
      </ol>
    </>
  );
}
