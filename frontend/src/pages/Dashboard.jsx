import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet } from "react-router-dom"
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff } from "react-icons/vsc"
import Sidebar from '../components/core/Dashboard/Sidebar'
import Loading from '../components/common/Loading'
import { setOpenSideMenu } from '../slices/sidebarSlice'

const Dashboard = () => {

    const { loading: authLoading } = useSelector((state) => state.auth);
    const { loading: profileLoading } = useSelector((state) => state.profile);
    const dispatch = useDispatch()


    if (profileLoading || authLoading) {
        return (
            <div className='mt-10'>
                <Loading />
            </div>
        )
    }
    // Scroll to the top of the page when the component mounts
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [])

    const { openSideMenu } = useSelector((state) => state.sidebar);

    return (
        <div className='relative flex min-h-[calc(100vh-3.5rem)] bg-richblack-900 overflow-hidden'>
            <button
                type='button'
                onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    dispatch(setOpenSideMenu(!openSideMenu))
                }}
                className={`fixed top-[4.5rem] z-50 flex h-10 w-10 items-center justify-center rounded-md border border-richblack-700 bg-richblack-800 text-richblack-100 shadow-xl transition hover:bg-richblack-700 hover:text-yellow-50 ${openSideMenu ? "left-[14.5rem]" : "left-4"}`}
                aria-label={openSideMenu ? "Collapse dashboard sidebar" : "Expand dashboard sidebar"}
                title={openSideMenu ? "Collapse dashboard sidebar" : "Expand dashboard sidebar"}
            >
                {openSideMenu ? <VscLayoutSidebarLeftOff size={20} /> : <VscLayoutSidebarLeft size={20} />}
            </button>

            <Sidebar />

            <div className={`h-[calc(100vh-3.5rem)] overflow-auto w-full transition-all duration-300 ${openSideMenu ? "flex-1" : "w-full"}`}>
                <div className={`mx-auto w-full max-w-[1600px] transition-all duration-300 ${openSideMenu ? "p-4 lg:p-10" : "pb-4 pl-16 pr-3 pt-4 lg:pb-6 lg:pl-20 lg:pr-6 lg:pt-6"}`}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default Dashboard
