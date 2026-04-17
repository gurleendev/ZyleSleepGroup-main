export function WelcomeScreen({ onNext }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-text">
      <div className="text-center">
        <div className="text-blue-400 text-6xl mb-2">Zzz</div>
        <h1 className="text-5xl font-bold text-primary mb-2">ZyleSleep</h1>
        <p className="text-lg italic font-handwriting mb-10">Sleep is the best meditation</p>
        <button
          onClick={onNext}
          className="bg-primary hover:bg-green-600 text-black font-bold px-6 py-2 rounded-lg shadow-md"
        >
          Let’s GO
        </button>
      </div>
    </div>
  );
}
