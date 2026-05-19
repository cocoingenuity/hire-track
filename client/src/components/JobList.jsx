import JobCard from './JobCard';

export default function JobList({ jobs, selectedJob, onSelect, onStatusChange }) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-600">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-sm">No jobs yet. Hit Refresh to scrape.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {jobs.map(job => (
        <JobCard
          key={job.id}
          job={job}
          isSelected={selectedJob?.id === job.id}
          onSelect={onSelect}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}
