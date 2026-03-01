const workflowTypes = [
	"Documentary",
	"Brand spots",
	"Interview packages",
	"Social content",
	"Internal comms",
];

export function SocialProofSection() {
	return (
		<section className="landing-appear landing-appear-delay-4 mx-auto mt-10 max-w-2xl text-center">
			<p className="text-sm leading-relaxed text-zinc-500">
				Built for teams cutting{" "}
				{workflowTypes.map((type, i) => (
					<span key={type}>
						{i > 0 && i < workflowTypes.length - 1 && ", "}
						{i === workflowTypes.length - 1 && ", and "}
						<span className="text-zinc-400">{type.toLowerCase()}</span>
					</span>
				))}
				.
			</p>
		</section>
	);
}
