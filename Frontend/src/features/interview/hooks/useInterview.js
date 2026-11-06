import { getAllInterviewReports, generateInterviewReport, getInterviewReportById, generateResumePdf } from '../services/interview.api'
import { useContext, useEffect, useState } from 'react'
import { InterviewContext } from '../interview.state'
import { useParams } from 'react-router'
import { requestError } from '../../../api'

export const useInterview = () => {
    const context = useContext(InterviewContext)
    const { interviewId } = useParams()
    const [error, setError] = useState('')
    const [fetching, setFetching] = useState(true)
    if (!context) throw new Error('useInterview must be used within an InterviewProvider')
    const { loading, setLoading, report, setReport, reports, setReports } = context
    useEffect(() => {
        let active = true
        const request = interviewId ? getInterviewReportById(interviewId) : getAllInterviewReports()
        request.then(data => {
            if (!active) return
            if (interviewId) setReport(data.interviewReport)
            else setReports(data.interviewReports)
        }).catch(err => {
            if (active) setError(requestError(err))
        }).finally(() => { if (active) setFetching(false) })
        return () => { active = false }
    }, [interviewId, setReport, setReports])
    const generateReport = async fields => {
        setLoading(true)
        setError('')
        try {
            const data = await generateInterviewReport(fields)
            setReport(data.interviewReport)
            return data.interviewReport
        } catch (err) {
            setError(requestError(err))
            return null
        } finally {
            setLoading(false)
        }
    }
    const getResumePdf = async interviewReportId => {
        setLoading(true)
        setError('')
        try {
            const response = await generateResumePdf({ interviewReportId })
            const url = URL.createObjectURL(response)
            const link = document.createElement('a')
            link.href = url
            link.download = 'resume_' + interviewReportId + '.pdf'
            document.body.appendChild(link)
            link.click()
            link.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (err) {
            if (err.response?.data instanceof Blob) {
                try { err.response.data = JSON.parse(await err.response.data.text()) } catch { /* Use fallback message. */ }
            }
            setError(requestError(err))
        } finally {
            setLoading(false)
        }
    }
    const currentReport = interviewId && report?._id !== interviewId ? null : report
    return { loading: loading || fetching, error, report: currentReport, reports, generateReport, getResumePdf }
}
